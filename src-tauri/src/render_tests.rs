use super::*;

fn request() -> RenderRequest {
    RenderRequest {relative_paths:vec!["son.mp4".into(),"muet.mp4".into(),"photo.png".into()],
        target_seconds:60,start_seconds:vec![Some(2.0),Some(0.0),None],
        end_seconds:vec![Some(4.0),Some(1.0),None],format:"9:16".into()}
}

#[test]
fn validates_cut_points_and_frame_accurate_duration() {
    let mut r=request();
    assert!(validate_render_request(&r).is_ok());
    r.end_seconds[0]=Some(1.0);
    assert!(validate_render_request(&r).is_err());
    r.end_seconds[0]=Some(f64::NAN);
    assert!(validate_render_request(&r).is_err());
    r=request();r.start_seconds[0]=Some(-1.0);
    assert!(validate_render_request(&r).is_err());
    for n in 1..=30 {
        let plan=montage_plan(60,n);
        assert!((plan.iter().map(|(_,d)|d).sum::<f64>()-60.0).abs()<0.000001);
        assert!(plan.iter().all(|(_,d)| (d*30.0-(d*30.0).round()).abs()<0.000001));
    }
    assert!(montage_plan(60,0).is_empty());
}

#[test]
#[ignore = "requires bundled FFmpeg; run explicitly in the Windows build"]
fn renders_sixty_seconds_with_audio_cuts_and_unchanged_sources() {
    let tools=Path::new(env!("CARGO_MANIFEST_DIR")).join("resources");
    let encoder=tools.join("ffmpeg.exe");let probe=tools.join("ffprobe.exe");
    assert!(encoder.is_file()&&probe.is_file());
    let temp=tempfile::tempdir().unwrap();
    let root=temp.path().join("SOUCY été");std::fs::create_dir(&root).unwrap();
    for (name,args) in [
        ("son.mp4",vec!["-f","lavfi","-i","color=blue:s=320x180:r=30000/1001","-f","lavfi","-i","sine=frequency=880:sample_rate=44100","-t","6","-c:v","libx264","-c:a","aac","-color_primaries","bt709"]),
        ("muet.mp4",vec!["-f","lavfi","-i","color=red:s=320x180:r=30","-t","1","-an","-c:v","libx264"]),
        ("photo.png",vec!["-f","lavfi","-i","color=green:s=320x180","-frames:v","1"])
    ] {
        let result=video_command(&encoder).args(["-hide_banner","-loglevel","error","-y"]).args(args).arg(root.join(name)).output().unwrap();
        assert!(result.status.success(),"{}",String::from_utf8_lossy(&result.stderr));
    }
    let r=request();
    let before:Vec<_>=r.relative_paths.iter().map(|p|std::fs::read(root.join(p)).unwrap()).collect();
    let output=temp.path().join("soucy-60.mp4");
    render_montage(&root,&output,&encoder,&probe,&r).unwrap();
    let (duration,audio)=probe_media(&probe,&output).unwrap();
    assert!((duration-60.0).abs()<0.15);assert!(audio);
    let video=video_command(&probe).args(["-v","error","-select_streams","v:0","-show_entries","stream=nb_frames,avg_frame_rate,color_space,color_transfer,color_primaries","-of","json"]).arg(&output).output().unwrap();
    let video:serde_json::Value=serde_json::from_slice(&video.stdout).unwrap();
    assert_eq!(video["streams"][0]["nb_frames"],"1800");
    assert_eq!(video["streams"][0]["avg_frame_rate"],"30/1");
    assert_eq!(video["streams"][0]["color_space"],"bt709");
    let project:serde_json::Value=serde_json::from_slice(&std::fs::read(output.with_extension("project.json")).unwrap()).unwrap();
    assert_eq!(project["clips"][0]["inMs"],2000);
    assert_eq!(project["clips"][0]["outMs"],4000);
    assert_eq!(project["clips"][0]["holdLastFrameMs"],3000);
    assert_eq!(project["clips"].as_array().unwrap().len(),12);
    // Decode audio from a source-backed part and a silent part, not just a stream-presence check.
    for (start,audible) in [(0.2,true),(3.0,false),(6.0,false),(10.5,false),(15.2,true)] {
        let raw=video_command(&encoder).args(["-v","error","-ss",&start.to_string(),"-i"]).arg(&output)
            .args(["-t","0.5","-map","0:a:0","-ac","1","-f","s16le","-"]).output().unwrap();
        assert!(raw.status.success());assert!(!raw.stdout.is_empty());
        let peak=raw.stdout.chunks_exact(2).map(|p|i16::from_le_bytes([p[0],p[1]]).unsigned_abs()).max().unwrap();
        assert_eq!(peak>100,audible,"audio at {start}: peak={peak}");
    }
    for (i,path) in r.relative_paths.iter().enumerate() {assert_eq!(std::fs::read(root.join(path)).unwrap(),before[i]);}
    assert!(render_montage(&root,&output,&encoder,&probe,&r).is_err());
    assert!(render_montage(&root,&root.join("forbidden.mp4"),&encoder,&probe,&r).is_err());
    let mut bad=request();bad.start_seconds[0]=Some(8.0);bad.end_seconds[0]=None;
    assert!(render_montage(&root,&temp.path().join("bad.mp4"),&encoder,&probe,&bad).is_err());
    assert!(!temp.path().join("bad.mp4").exists());
}
