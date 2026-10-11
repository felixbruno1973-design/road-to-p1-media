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
        let output=Command::new(&ffmpeg)
            .args(["-hide_banner","-nostdin","-loglevel","error","-t","60","-i"])
            .arg(&file)
            .args(["-vf","fps=1/5,scale=160:-1,tile=3x4","-frames:v","1","-f","image2pipe","-vcodec","mjpeg","-"])
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
        let output = Command::new(&probe).args(["-v","error","-show_entries",
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
async fn save_studio_project(content: String) -> Result<Option<String>, String> {
    if content.len() > 1_000_000 || !content.contains("\"road-to-p1-usb-draft\"") {
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
        std::fs::write(&target, content).map_err(|e| format!("Enregistrement impossible : {e}"))?;
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
    // Use complete cycles of the editorial input order. Partial cycles can
    // otherwise skew the requested briefing/track ratio towards first items.
    let desired=((total_seconds as f64 / 5.0).ceil() as usize).max(input_count);
    let cycles=desired.div_ceil(input_count);
    let count=(cycles*input_count).min(120);
    let duration=total_seconds as f64/count as f64;
    (0..count).map(|i|(i%input_count,duration)).collect()
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
}

#[tauri::command]
async fn render_auto_montage(app: tauri::AppHandle, state: tauri::State<'_, SelectedFolder>, request: RenderRequest) -> Result<Option<String>, String> {
    let root = state.0.lock().map_err(|_| "Dossier USB indisponible.")?
      .clone().ok_or("Choisis d'abord un dossier USB.")?;
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
    let Some(output) = rfd::FileDialog::new()
        .add_filter("Vidéo MP4", &["mp4"])
        .set_file_name("road-to-p1-montage.mp4")
        .save_file() else { return Ok(None); };
    if output.extension().and_then(|s|s.to_str()).map(|s|s.eq_ignore_ascii_case("mp4")) != Some(true) {
        return Err("La sortie doit être un fichier MP4.".into());
    }
    let encoder=video_tool(&app,"ffmpeg")?;
    let probe=video_tool(&app,"ffprobe")?;
    tauri::async_runtime::spawn_blocking(move || {
        let root = root.canonicalize().map_err(|e|e.to_string())?;
        let parent=output.parent().ok_or("Dossier de sortie invalide.")?
            .canonicalize().map_err(|e|e.to_string())?;
        if parent.starts_with(&root) {return Err("Choisis un dossier de sortie en dehors des vidéos USB.".into());}
        let temp=tempfile::tempdir().map_err(|e|e.to_string())?;
        let mut segments=Vec::new();
        let mut scene_cache: HashMap<PathBuf, Vec<f64>>=HashMap::new();
        let mut duration_cache: HashMap<PathBuf, f64>=HashMap::new();
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
            if kind(rel)==Some("Photo") {
                if !matches!(rel.extension().and_then(|s|s.to_str()).map(|s|s.to_ascii_lowercase()).as_deref(),Some("jpg"|"jpeg"|"png"|"webp")) {
                    return Err("Format photo non pris en charge pour le MP4 : utilise JPG, PNG ou WebP.".into());
                }
                let segment=temp.path().join(format!("clip-{index:04}.mp4"));
                let status=Command::new(&encoder)
                    .args(["-hide_banner","-loglevel","error","-y","-loop","1","-framerate","30","-i"])
                    .arg(&file).args(["-t",&seconds_per_clip.to_string(),"-vf",
                        "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30",
                        "-an","-c:v","libx264","-pix_fmt","yuv420p","-preset","veryfast"])
                    .arg(&segment).status().map_err(|e|format!("Photo impossible à lire : {e}"))?;
                if !status.success() {return Err(format!("Erreur de rendu sur la photo {}",index+1));}
                segments.push(segment);
                continue;
            }
            // Inspect duration locally and avoid always starting at the first frame.
            let duration=*duration_cache.entry(file.clone()).or_insert_with(|| {
                let result=Command::new(&probe).args(["-v","error","-show_entries","format=duration",
                    "-of","default=noprint_wrappers=1:nokey=1"]).arg(&file).output();
                match result {
                    Ok(output) if output.status.success() =>
                        String::from_utf8_lossy(&output.stdout).trim().parse::<f64>().unwrap_or(0.0),
                    _=>0.0
                }
            });
            if !duration.is_finite() || duration <= 0.0 {return Err(format!("Durée invalide pour la vidéo {}",index+1));}
            // Repeat short source footage to fill its allocated montage slot.
            let clip_seconds=seconds_per_clip.max(0.1);
            let max_start=(duration-clip_seconds).max(0.0);
            let previous=used_starts.entry(file.clone()).or_default();
            let requested_start=request.start_seconds.get(source_index).and_then(|t|*t);
            let start=if let Some(time)=requested_start {
                // Exact timing reviewed in Library: do not waste time with scene detection.
                time.min(max_start)
            } else {
                let fallback=sample_start(duration,clip_seconds,index);
                let inspect=duration.min(90.0);
                let scene_times=scene_cache.entry(file.clone()).or_insert_with(|| {
                    let analysis=Command::new(&encoder)
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
            let segment=temp.path().join(format!("clip-{index:04}.mp4"));
            let status=Command::new(&encoder)
                .args(["-hide_banner","-loglevel","error","-y","-stream_loop","-1","-ss",&start.to_string(),"-i"])
                .arg(&file).args(["-t",&clip_seconds.to_string(),"-vf",
                    "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30",
                    "-an","-c:v","libx264","-pix_fmt","yuv420p","-preset","veryfast"])
                .arg(&segment)
                .status().map_err(|e|format!("FFmpeg doit être installé sur le PC : {e}"))?;
            if !status.success() {return Err(format!("Erreur FFmpeg sur la vidéo {}",index+1));}
            segments.push(segment);
        }
        let concat=temp.path().join("concat.txt");
        let entries=segments.iter().map(|p|{
            let s=p.to_string_lossy().replace('\\',"/");
            format!("file '{}'",s.replace("'","'\\''"))
        }).collect::<Vec<_>>().join("\n");
        std::fs::write(&concat,entries).map_err(|e|e.to_string())?;
        let tmp_output=temp.path().join("montage.mp4");
        let status=Command::new(&encoder)
            .args(["-hide_banner","-loglevel","error","-y","-f","concat","-safe","0","-i"])
            .arg(&concat).args(["-c","copy","-movflags","+faststart"]).arg(&tmp_output)
            .status().map_err(|e|e.to_string())?;
        if !status.success(){return Err("Assemblage vidéo impossible.".into());}
        // Check the actual result before copying anything into the user's destination.
        let verified=Command::new(&probe)
            .args(["-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1"])
            .arg(&tmp_output).output().map_err(|e|format!("Vérification MP4 impossible : {e}"))?;
        if !verified.status.success() {return Err("Le fichier MP4 assemblé est illisible.".into());}
        let actual=String::from_utf8_lossy(&verified.stdout).trim().parse::<f64>()
            .map_err(|_|"Impossible de vérifier la durée du montage.".to_string())?;
        if !actual.is_finite() || actual<=0.0 ||
           (actual-request.target_seconds as f64).abs()>2.0 {
            return Err(format!("Montage incomplet : {:.1} s au lieu des {} s demandées. Aucun fichier incomplet enregistré.",actual,request.target_seconds));
        }
        std::fs::copy(&tmp_output,&output).map_err(|e|format!("Enregistrement MP4 impossible : {e}"))?;
        Ok(Some(output.to_string_lossy().to_string()))
    }).await.map_err(|e|format!("Erreur de rendu : {e}"))?
}

fn main() {
    tauri::Builder::default()
        .manage(SelectedFolder::default())
        .invoke_handler(tauri::generate_handler![preview_video_frames, choose_and_scan_folder, save_studio_project, probe_selected_video, render_auto_montage, check_video_engine])
        .run(tauri::generate_context!())
        .expect("Erreur au lancement de Road to P1 Media");
}

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
