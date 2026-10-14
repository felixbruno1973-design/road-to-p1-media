#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use base64::Engine;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::collections::HashMap;
use std::process::Command;
use tauri::Manager;
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MediaFile {
    relative_path: String,
    category: String,
    size_bytes: u64,
    modified_ms: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanResult {
    source_name: String,
    total_count: usize,
    files: Vec<MediaFile>,
    warnings: Vec<String>,
}

fn kind(path: &Path) -> Option<&'static str> {
    match path.extension()?.to_str()?.to_ascii_lowercase().as_str() {
        "mp4" | "mov" | "avi" | "mkv" | "webm" | "m4v" => Some("Vidéo"),
        "jpg" | "jpeg" | "png" | "webp" | "tif" | "tiff" | "heic" => Some("Photo"),
        "mp3" | "wav" | "aac" | "flac" | "m4a" => Some("Audio"),
        _ => None,
    }
}

#[derive(Default)]
struct SelectedFolder(Mutex<Option<PathBuf>>);

fn video_tool(app: &tauri::AppHandle, name: &str) -> Result<PathBuf, String> {
    let dir=app.path().resource_dir().map_err(|e|e.to_string())?;
    let binary=dir.join("resources").join(format!("{name}.exe"));
    if binary.is_file() { Ok(binary) }
    else { Err(format!("Moteur vidéo intégré absent : {name}.exe")) }
}

#[tauri::command]
async fn preview_video_frames(app: tauri::AppHandle, state: tauri::State<'_, SelectedFolder>, relative_path: String) -> Result<String, String> {
    let root=state.0.lock().map_err(|_|"Dossier USB indisponible.")?.clone()
        .ok_or("Sélectionne d'abord un dossier USB.")?;
    let ffmpeg=video_tool(&app,"ffmpeg")?;
    tauri::async_runtime::spawn_blocking(move || {
        let rel=Path::new(&relative_path);
        if rel.is_absolute() || rel.components().any(|p|!matches!(p,std::path::Component::Normal(_)))
            || kind(rel)!=Some("Vidéo") {return Err("Vidéo non autorisée.".to_string());}
        let root=root.canonicalize().map_err(|e|e.to_string())?;
        let file=root.join(rel).canonicalize().map_err(|e|e.to_string())?;
        if !file.starts_with(&root)||!file.is_file(){return Err("Vidéo hors du dossier USB.".into());}
        // Twelve frames across the first minute: a visible local contact sheet, no uploads.
        let output=video_command(&ffmpeg)
            .args(["-hide_banner","-nostdin","-loglevel","error","-t","60","-i"])
            .arg(&file)
            .args(["-vf","fps=1/5,scale=320:-1,tile=3x4","-frames:v","1","-f","image2pipe","-vcodec","mjpeg","-"])
            .output().map_err(|e|e.to_string())?;
        if !output.status.success() || output.stdout.is_empty() {
            return Err("Impossible d'extraire les images de cette vidéo.".into());
        }
        Ok(format!("data:image/jpeg;base64,{}",base64::engine::general_purpose::STANDARD.encode(&output.stdout)))
    }).await.map_err(|e|e.to_string())?
}

#[tauri::command]
async fn probe_selected_video(app: tauri::AppHandle, state: tauri::State<'_, SelectedFolder>, relative_path: String) -> Result<serde_json::Value, String> {
    let root = state.0.lock().map_err(|_| "Verrou du dossier indisponible.")?
        .clone().ok_or("Choisis d'abord un dossier USB dans Library.")?;
    let probe=video_tool(&app, "ffprobe")?;
    tauri::async_runtime::spawn_blocking(move || {
        let rel = Path::new(&relative_path);
        if rel.is_absolute() || rel.components().any(|part| !matches!(part, std::path::Component::Normal(_))) {
            return Err("Chemin relatif invalide.".into());
        }
        if kind(rel) != Some("Vidéo") { return Err("Ce fichier n'est pas une vidéo reconnue.".into()); }
        let file = root.join(rel).canonicalize().map_err(|e| e.to_string())?;
        if !file.starts_with(&root) || !file.is_file() { return Err("Fichier hors du dossier autorisé.".into()); }
        let output = video_command(&probe).args(["-v","error","-show_entries",
          "format=duration:stream=codec_type,codec_name,width,height,avg_frame_rate",
          "-of","json"]).arg(&file).output().map_err(|e|
          format!("FFprobe indisponible sur ce PC : {e}"))?;
        if !output.status.success() { return Err("Analyse FFprobe impossible pour cette vidéo.".into()); }
        let data: serde_json::Value = serde_json::from_slice(&output.stdout).map_err(|e|e.to_string())?;
        let video = data["streams"].as_array().and_then(|xs|xs.iter().find(|s|s["codec_type"]=="video"))
          .ok_or("Flux vidéo introuvable.")?;
        Ok(serde_json::json!({
          "durationSeconds":data["format"]["duration"].as_str().and_then(|s|s.parse::<f64>().ok()),
          "width": video["width"],"height":video["height"],
          "codec":video["codec_name"],"frameRate":video["avg_frame_rate"],
          "hasAudio":data["streams"].as_array().map(|xs|xs.iter().any(|s|s["codec_type"]=="audio")).unwrap_or(false)
        }))
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn choose_and_scan_folder(state: tauri::State<'_, SelectedFolder>) -> Result<Option<ScanResult>, String> {
    // Disk traversal runs off the Tauri UI thread.
    let chosen = tauri::async_runtime::spawn_blocking(|| {
        // Explicit user selection grants access to this folder only.
        let Some(root) = rfd::FileDialog::new().pick_folder() else { return Ok(None); };
        let canonical = root.canonicalize().map_err(|e|e.to_string())?;
        scan(&canonical).map(|result|Some((result,canonical)))
    })
    .await
    .map_err(|error| format!("Erreur du processus d'indexation : {error}"))??;
    if let Some((_, ref root)) = chosen {
        *state.0.lock().map_err(|_| "Verrou du dossier indisponible.")? = Some(root.clone());
    }
    Ok(chosen.map(|(result, _)| result))
}

fn scan(root: &Path) -> Result<ScanResult, String> {
    let root = root.canonicalize().map_err(|e| e.to_string())?;
    if !root.is_dir() { return Err("Le chemin sélectionné n'est pas un dossier.".into()); }
    let mut files = Vec::new();
    let mut warnings = Vec::new();
    for item in WalkDir::new(&root).follow_links(false).into_iter() {
        let entry = match item {
            Ok(e) => e,
            Err(e) => { if warnings.len() < 20 {warnings.push(e.to_string());} continue; }
        };
        if !entry.file_type().is_file() { continue; }
        let Some(category) = kind(entry.path()) else { continue; };
        if files.len() >= 500_000 { return Err("Limite de 500 000 fichiers atteinte.".into()); }
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(e) => { if warnings.len() < 20 { warnings.push(e.to_string()); } continue; }
        };
        let modified_ms = meta.modified().ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64).unwrap_or(0);
        let relative_path = entry.path().strip_prefix(&root).map_err(|e|e.to_string())?
            .to_string_lossy().replace('\\', "/");
        files.push(MediaFile {
            relative_path, category: category.into(), size_bytes: meta.len(), modified_ms,
        });
    }
    files.sort_by(|a,b| a.relative_path.cmp(&b.relative_path));
    let source_name = root.file_name().unwrap_or_default().to_string_lossy().to_string();
    Ok(ScanResult {source_name,total_count:files.len(),files,warnings})
}


#[tauri::command]
async fn save_studio_project(state: tauri::State<'_, SelectedFolder>, content: String) -> Result<Option<String>, String> {
    let root=state.0.lock().map_err(|_|"Dossier indisponible.")?.clone();
    let project:serde_json::Value=serde_json::from_str(&content).map_err(|_|"Projet JSON invalide.")?;
    if content.len() > 1_000_000 || project["kind"]!="road-to-p1-usb-draft" {
        return Err("Projet invalide ou trop volumineux.".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let Some(target) = rfd::FileDialog::new()
            .add_filter("Projet Road to P1", &["json"])
            .set_file_name("road-to-p1-montage-projet.json")
            .save_file() else { return Ok(None); };
        if target.extension().and_then(|x| x.to_str()).map(|x| x.eq_ignore_ascii_case("json")) != Some(true) {
            return Err("Le fichier doit porter l'extension .json.".into());
        }
        let parent=target.parent().ok_or("Destination invalide.")?.canonicalize().map_err(|e|e.to_string())?;
        if let Some(root)=root {
            if parent.starts_with(root) {return Err("Enregistre le projet en dehors du dossier source.".into());}
        }
        use std::io::Write;
        let mut file=std::fs::OpenOptions::new().write(true).create_new(true).open(&target)
            .map_err(|e|format!("Choisis un nouveau nom de projet : {e}"))?;
        file.write_all(content.as_bytes()).map_err(|e|format!("Enregistrement impossible : {e}"))?;
        Ok(Some(target.to_string_lossy().to_string()))
    }).await.map_err(|e| format!("Erreur système : {e}"))?
}


#[tauri::command]
async fn check_video_engine(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let ffmpeg=video_tool(&app,"ffmpeg").is_ok();
    let ffprobe=video_tool(&app,"ffprobe").is_ok();
    tauri::async_runtime::spawn_blocking(move || {
        let ffmpeg = ffmpeg;
        let ffprobe = ffprobe;
        Ok(serde_json::json!({"ffmpegAvailable": ffmpeg, "ffprobeAvailable": ffprobe}))
    }).await.map_err(|e|e.to_string())?
}

fn parse_visual_changes(stderr: &str) -> Vec<f64> {
    stderr.lines().filter_map(|line| {
        let start=line.find("pts_time:")?;
        let raw=line[start+9..].split_whitespace().next()?;
        let t=raw.parse::<f64>().ok()?;
        if t.is_finite() && t>=0.0 {Some(t)} else {None}
    }).collect()
}

fn choose_scene_start(changes: &[f64], fallback: f64, max_start: f64, index: usize) -> f64 {
    if changes.is_empty() {return fallback.clamp(0.0,max_start);}
    let candidate=changes[index % changes.len()];
    (candidate-0.5).clamp(0.0,max_start)
}

fn choose_nonrepeating_start(changes: &[f64], fallback: f64, max_start: f64, index: usize, clip_seconds: f64, used: &[f64]) -> f64 {
    let mut candidates: Vec<f64>=changes.iter().map(|t|(t-0.5).clamp(0.0,max_start)).collect();
    if candidates.is_empty() {
        let slots=((max_start/clip_seconds.max(0.2)).floor() as usize).saturating_add(1).clamp(1,100);
        candidates=(0..slots).map(|i|(i as f64 * clip_seconds).min(max_start)).collect();
    }
    let separation=clip_seconds*0.8;
    candidates.sort_by(|a,b|{
        let da=used.iter().map(|u|(a-u).abs()).fold(f64::INFINITY,f64::min);
        let db=used.iter().map(|u|(b-u).abs()).fold(f64::INFINITY,f64::min);
        let pa=if da>=separation {1} else {0};
        let pb=if db>=separation {1} else {0};
        pb.cmp(&pa).then_with(||db.total_cmp(&da))
    });
    if used.is_empty(){choose_scene_start(changes,fallback,max_start,index)}
    else {candidates[0]}
}

fn montage_plan(total_seconds: u32, input_count: usize) -> Vec<(usize, f64)> {
    if input_count == 0 { return Vec::new(); }
    // Use complete cycles of the editorial input order. Partial cycles can
    // otherwise skew the requested briefing/track ratio towards first items.
    let desired=((total_seconds as f64 / 5.0).ceil() as usize).max(input_count);
    let cycles=desired.div_ceil(input_count);
    let count=(cycles*input_count).min(120);
    let frames = total_seconds as usize * 30;
    (0..count).map(|i| (i % input_count,
        (frames / count + usize::from(i < frames % count)) as f64 / 30.0)).collect()
}

fn sample_start(duration: f64, clip_seconds: f64, index: usize) -> f64 {
    let available=(duration-clip_seconds).max(0.0);
    available * match index % 3 {0=>0.25,1=>0.5,_=>0.7}
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct RenderRequest {
    relative_paths: Vec<String>,
    target_seconds: u32,
    #[serde(default)]
    start_seconds: Vec<Option<f64>>,
    #[serde(default)]
    end_seconds: Vec<Option<f64>>,
    #[serde(default = "default_format")]
    format: String,
}

fn default_format() -> String { "9:16".into() }

#[tauri::command]
async fn render_auto_montage(app: tauri::AppHandle, state: tauri::State<'_, SelectedFolder>, request: RenderRequest) -> Result<Option<String>, String> {
    let root = state.0.lock().map_err(|_| "Dossier USB indisponible.")?
      .clone().ok_or("Choisis d'abord un dossier USB.")?;
    validate_render_request(&request)?;
    let Some(output) = rfd::FileDialog::new()
        .add_filter("Vidéo MP4", &["mp4"])
        .set_file_name("road-to-p1-montage.mp4")
        .save_file() else { return Ok(None); };
    if output.extension().and_then(|s|s.to_str()).map(|s|s.eq_ignore_ascii_case("mp4")) != Some(true) {
        return Err("La sortie doit être un fichier MP4.".into());
    }
    let encoder=video_tool(&app,"ffmpeg")?;
    let probe=video_tool(&app,"ffprobe")?;
    tauri::async_runtime::spawn_blocking(move || render_montage(&root,&output,&encoder,&probe,&request).map(Some))
        .await.map_err(|e|format!("Erreur de rendu : {e}"))?
}

fn validate_render_request(request: &RenderRequest) -> Result<(),String> {
    if request.relative_paths.is_empty() || request.relative_paths.len() > 30 ||
       request.target_seconds < 5 || request.target_seconds > 600 {
        return Err("Sélection ou durée invalide (1 à 30 médias, 5 à 600 secondes).".into());
    }
    if !request.start_seconds.is_empty() && request.start_seconds.len()!=request.relative_paths.len() {
        return Err("Les minutages ne correspondent pas à la sélection.".into());
    }
    if request.start_seconds.iter().flatten().any(|t|!t.is_finite()||*t<0.0) {
        return Err("Un minutage de scène est invalide.".into());
    }

    if !["9:16","16:9"].contains(&request.format.as_str()) {return Err("Format invalide.".into());}
    if !request.end_seconds.is_empty() && request.end_seconds.len()!=request.relative_paths.len() {return Err("Fins de coupe incohérentes.".into());}
    for (i,end) in request.end_seconds.iter().enumerate() {
        if let Some(end)=end {
            let start=request.start_seconds.get(i).and_then(|t|*t).unwrap_or(0.0);
            if !end.is_finite() || *end<=start {return Err("Fin de coupe invalide.".into());}
        }
    }
    Ok(())
}

fn video_command(binary: &Path) -> Command {
    let mut command=Command::new(binary);
    #[cfg(windows)] {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    command
}

fn probe_media(probe: &Path, file: &Path) -> Result<(f64,bool),String> {
    let result=video_command(probe).args(["-v","error","-show_entries","format=duration:stream=codec_type","-of","json"])
        .arg(file).output().map_err(|e|e.to_string())?;
    if !result.status.success() {return Err(format!("Média illisible : {}",file.display()));}
    let data:serde_json::Value=serde_json::from_slice(&result.stdout).map_err(|e|e.to_string())?;
    let duration=data["format"]["duration"].as_str().and_then(|s|s.parse::<f64>().ok()).unwrap_or(0.0);
    if !duration.is_finite() || duration<=0.0 {return Err("Durée média invalide.".into());}
    let has_audio=data["streams"].as_array().map(|s|s.iter().any(|s|s["codec_type"]=="audio")).unwrap_or(false);
    Ok((duration,has_audio))
}

fn render_montage(root: &Path, output: &Path, encoder: &Path, probe: &Path, request: &RenderRequest) -> Result<String, String> {
        validate_render_request(request)?;
        let root = root.canonicalize().map_err(|e|e.to_string())?;
        let parent=output.parent().ok_or("Dossier de sortie invalide.")?
            .canonicalize().map_err(|e|e.to_string())?;
        if parent.starts_with(&root) {return Err("Choisis un dossier de sortie en dehors des vidéos USB.".into());}
        if output.exists() || std::fs::symlink_metadata(output).is_ok() {
            return Err("Le fichier de sortie existe déjà. Choisis un nouveau nom.".into());
        }
        let project_output=output.with_extension("project.json");
        if project_output.exists() { return Err("Le projet associé existe déjà. Choisis un nouveau nom.".into()); }
        let (width,height)=if request.format=="16:9" {(1920,1080)} else {(1080,1920)};
        let scale=format!("scale={width}:{height}:force_original_aspect_ratio=decrease:out_color_matrix=bt709:out_range=tv,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30:start_time=0");
        let mut edit_clips=Vec::new();
        let temp=tempfile::tempdir().map_err(|e|e.to_string())?;
        let mut segments=Vec::new();
        let mut scene_cache: HashMap<PathBuf, Vec<f64>>=HashMap::new();
        let mut metadata_cache: HashMap<PathBuf, (f64,bool)>=HashMap::new();
        let mut used_starts: HashMap<PathBuf, Vec<f64>>=HashMap::new();
        let plan=montage_plan(request.target_seconds,request.relative_paths.len());
        for (index,(source_index,seconds_per_clip)) in plan.iter().copied().enumerate() {
            let path=&request.relative_paths[source_index];
            let rel=Path::new(path);
            if rel.is_absolute() || rel.components().any(|p|!matches!(p,std::path::Component::Normal(_))) ||
               !matches!(kind(rel),Some("Vidéo"|"Photo")) {
                return Err("Nom de vidéo non autorisé.".into());
            }
            let file=root.join(rel).canonicalize().map_err(|e|e.to_string())?;
            if !file.starts_with(&root) || !file.is_file() {
                return Err("Vidéo inaccessible dans le dossier USB.".into());
            }
            let photo=kind(rel)==Some("Photo");
            if photo && !matches!(rel.extension().and_then(|s|s.to_str()).map(|s|s.to_ascii_lowercase()).as_deref(),Some("jpg"|"jpeg"|"png"|"webp")) {
                return Err("Format photo non pris en charge : utilise JPG, PNG ou WebP.".into());
            }
            let (duration,has_audio)=if photo {(seconds_per_clip,false)} else {
                if !metadata_cache.contains_key(&file) { metadata_cache.insert(file.clone(), probe_media(probe,&file)?); }
                metadata_cache[&file]
            };
            let clip_seconds=seconds_per_clip;
            let max_start=(duration-clip_seconds).max(0.0);
            let previous=used_starts.entry(file.clone()).or_default();
            let requested_start=request.start_seconds.get(source_index).and_then(|t|*t);
            let start=if photo {0.0} else if let Some(time)=requested_start {
                // Exact timing reviewed in Library: do not waste time with scene detection.
                if time>=duration { return Err(format!("Point de coupe hors de la vidéo : {path}")); }
                time
            } else {
                let fallback=sample_start(duration,clip_seconds,index);
                let inspect=duration.min(90.0);
                let scene_times=scene_cache.entry(file.clone()).or_insert_with(|| {
                    let analysis=video_command(&encoder)
                        .args(["-hide_banner","-nostdin","-loglevel","info","-t",&inspect.to_string(),"-i"])
                        .arg(&file).args(["-vf","fps=2,select='gt(scene,0.15)',showinfo",
                            "-an","-f","null","-"]).output();
                    match analysis {
                        Ok(result) if result.status.success() =>
                            parse_visual_changes(&String::from_utf8_lossy(&result.stderr)),
                        _=>Vec::new()
                    }
                });
                let eligible:Vec<f64>=scene_times.iter().copied().filter(|t|*t<=max_start).collect();
                choose_nonrepeating_start(&eligible,fallback,max_start,index,clip_seconds,previous)
            };
            previous.push(start);
            let end=request.end_seconds.get(source_index).and_then(|t|*t).unwrap_or(duration);
            if !photo && (end>duration+0.05 || end<=start) { return Err(format!("Fin de coupe invalide : {path}")); }
            let available=if photo {clip_seconds} else {(end.min(duration)-start).min(clip_seconds)};
            let segment=temp.path().join(format!("clip-{index:04}.mov"));
            let mut command=video_command(encoder);
            command.args(["-hide_banner","-nostdin","-loglevel","error","-y"]);
            if photo { command.args(["-loop","1","-framerate","30"]); }
            else { command.args(["-ss",&start.to_string(),"-t",&available.to_string()]); }
            command.arg("-i").arg(&file);
            if !has_audio { command.args(["-f","lavfi","-i","anullsrc=r=48000:cl=stereo"]); }
            // PCM intermediate audio avoids AAC priming gaps at every cut. AAC is encoded once at assembly.
            command.args(["-map","0:v:0","-map",if has_audio {"0:a:0"} else {"1:a:0"},
                "-t",&clip_seconds.to_string(),"-vf",&format!("{scale},tpad=stop_mode=clone:stop_duration={clip_seconds}"),
                "-af","aresample=48000,apad","-ar","48000","-ac","2","-c:a","pcm_s16le",
                "-c:v","libx264","-pix_fmt","yuv420p","-preset","veryfast","-video_track_timescale","90000",
                "-map_metadata","-1","-colorspace","bt709","-color_primaries","bt709","-color_trc","bt709","-color_range","tv"]);
            let status=command.arg(&segment).output().map_err(|e|format!("Moteur vidéo intégré indisponible : {e}"))?;
            if !status.status.success() {return Err(format!("Erreur FFmpeg sur {path} : {}",String::from_utf8_lossy(&status.stderr)));}
            edit_clips.push(serde_json::json!({"relativePath":path,"category":if photo {"Photo"} else {"Vidéo"},
                "order":index,"inMs":(start*1000.0).round() as u64,"outMs":((start+available)*1000.0).round() as u64,
                "durationMs":(clip_seconds*1000.0).round() as u64,"hasAudio":has_audio,
                "holdLastFrameMs":((clip_seconds-available)*1000.0).round() as u64}));
            segments.push(segment);
        }
        let concat=temp.path().join("concat.txt");
        let entries=segments.iter().map(|p|{
            let s=p.to_string_lossy().replace('\\',"/");
            format!("file '{}'",s.replace("'","'\\''"))
        }).collect::<Vec<_>>().join("\n");
        std::fs::write(&concat,entries).map_err(|e|e.to_string())?;
        let tmp_output=temp.path().join("montage.mp4");
        let status=video_command(&encoder)
            .args(["-hide_banner","-loglevel","error","-y","-f","concat","-safe","0","-i"])
            .arg(&concat).args(["-map","0:v:0","-map","0:a:0","-c:v","copy","-c:a","aac","-b:a","192k","-t",&request.target_seconds.to_string(),"-movflags","+faststart"]).arg(&tmp_output)
            .status().map_err(|e|e.to_string())?;
        if !status.success(){return Err("Assemblage vidéo impossible.".into());}
        // Check the actual result before copying anything into the user's destination.
        let verified=video_command(&probe)
            .args(["-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1"])
            .arg(&tmp_output).output().map_err(|e|format!("Vérification MP4 impossible : {e}"))?;
        if !verified.status.success() {return Err("Le fichier MP4 assemblé est illisible.".into());}
        let actual=String::from_utf8_lossy(&verified.stdout).trim().parse::<f64>()
            .map_err(|_|"Impossible de vérifier la durée du montage.".to_string())?;
        if !actual.is_finite() || actual<=0.0 ||
           (actual-request.target_seconds as f64).abs()>0.15 {
            return Err(format!("Montage incomplet : {:.1} s au lieu des {} s demandées. Aucun fichier incomplet enregistré.",actual,request.target_seconds));
        }
        let (_,has_audio)=probe_media(probe,&tmp_output)?;
        if !has_audio {return Err("Piste audio absente du montage.".into());}
        let project=serde_json::json!({"schemaVersion":1,"kind":"road-to-p1-usb-draft",
            "sourceLabel":root.file_name().unwrap_or_default().to_string_lossy(),
            "targetDurationMs":request.target_seconds*1000,"output":{"width":width,"height":height,"fps":30},
            "clips":edit_clips});
        // Exclusive creation also rejects symlinks and hard links to existing source files.
        let mut saved=std::fs::OpenOptions::new().write(true).create_new(true).open(output).map_err(|e|e.to_string())?;
        let result=(|| -> Result<(),String> {
            std::io::copy(&mut std::fs::File::open(&tmp_output).map_err(|e|e.to_string())?,&mut saved).map_err(|e|e.to_string())?;
            saved.sync_all().map_err(|e|e.to_string())?;
            let mut project_file=std::fs::OpenOptions::new().write(true).create_new(true).open(&project_output).map_err(|e|e.to_string())?;
            use std::io::Write;
            project_file.write_all(serde_json::to_string_pretty(&project).map_err(|e|e.to_string())?.as_bytes()).map_err(|e|e.to_string())?;
            Ok(())
        })();
        drop(saved);
        if let Err(error)=result { let _=std::fs::remove_file(output); return Err(error); }
        Ok(output.to_string_lossy().to_string())
}


fn main() {
    tauri::Builder::default()
        .manage(SelectedFolder::default())
        .invoke_handler(tauri::generate_handler![preview_video_frames, choose_and_scan_folder, save_studio_project, probe_selected_video, render_auto_montage, check_video_engine])
        .run(tauri::generate_context!())
        .expect("Erreur au lancement de Road to P1 Media");
}

#[cfg(test)]
mod render_tests;

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn media_types() {
        assert_eq!(kind(Path::new("race.MP4")),Some("Vidéo"));
        assert_eq!(kind(Path::new("photo.jpg")),Some("Photo"));
        assert_eq!(kind(Path::new("notes.txt")),None);
        assert!((sample_start(100.0,10.0,0)-22.5).abs()<0.001);
        assert!((sample_start(100.0,10.0,1)-45.0).abs()<0.001);
        assert_eq!(sample_start(5.0,10.0,2),0.0);
        assert_eq!(parse_visual_changes("pts_time:3.1 rest\npts_time:7.2 rest"),vec![3.1,7.2]);
        assert!(parse_visual_changes("no change").is_empty());
        assert_eq!(choose_scene_start(&[3.0,15.0],0.0,30.0,0),2.5);
        assert_eq!(choose_scene_start(&[3.0,15.0],0.0,30.0,1),14.5);
        assert_eq!(choose_scene_start(&[],5.0,10.0,1),5.0);
        let first=choose_nonrepeating_start(&[5.0,20.0,35.0],0.0,40.0,0,5.0,&[]);
        let second=choose_nonrepeating_start(&[5.0,20.0,35.0],0.0,40.0,1,5.0,&[first]);
        assert!((first-second).abs()>=4.0);
        let plan=montage_plan(45,2);
        assert_eq!(plan.len(),10);
        assert_eq!(plan[0],(0,4.5));
        assert_eq!(plan[1],(1,4.5));
        let balanced=montage_plan(60,10);
        assert_eq!(balanced.len(),20);
        assert_eq!(balanced.iter().filter(|(source,_)| *source<8).count(),16);
        assert_eq!(balanced.iter().filter(|(source,_)| *source>=8).count(),4);
    }
}
