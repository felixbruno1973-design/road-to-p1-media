#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::process::Command;
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

#[tauri::command]
async fn probe_selected_video(state: tauri::State<'_, SelectedFolder>, relative_path: String) -> Result<serde_json::Value, String> {
    let root = state.0.lock().map_err(|_| "Verrou du dossier indisponible.")?
        .clone().ok_or("Choisis d'abord un dossier USB dans Library.")?;
    tauri::async_runtime::spawn_blocking(move || {
        let rel = Path::new(&relative_path);
        if rel.is_absolute() || rel.components().any(|part| !matches!(part, std::path::Component::Normal(_))) {
            return Err("Chemin relatif invalide.".into());
        }
        if kind(rel) != Some("Vidéo") { return Err("Ce fichier n'est pas une vidéo reconnue.".into()); }
        let file = root.join(rel).canonicalize().map_err(|e| e.to_string())?;
        if !file.starts_with(&root) || !file.is_file() { return Err("Fichier hors du dossier autorisé.".into()); }
        let output = Command::new("ffprobe").args(["-v","error","-show_entries",
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
    .map_err(|error| format!("Erreur du processus d'indexation : {error}"))?;
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

fn main() {
    tauri::Builder::default()
        .manage(SelectedFolder::default())
        .invoke_handler(tauri::generate_handler![choose_and_scan_folder, save_studio_project, probe_selected_video])
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
    }
}
