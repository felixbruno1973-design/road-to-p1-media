#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::path::{Path, PathBuf};
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

#[tauri::command]
fn choose_and_scan_folder() -> Result<Option<ScanResult>, String> {
    // Native user interaction is the authorization boundary.
    let Some(root) = rfd::FileDialog::new().pick_folder() else { return Ok(None); };
    scan(&root).map(Some)
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

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![choose_and_scan_folder])
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
