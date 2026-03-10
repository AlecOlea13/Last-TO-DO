import { useState, useRef } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";

export default function Profile() {
  const { user }    = useOutletContext<{ user: any }>();
  const navigate    = useNavigate();
  const fileRef     = useRef<HTMLInputElement>(null);

  const [name, setName]           = useState(user?.name ?? "");
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview]     = useState<string | null>(
    user?.profileImage ?? null
  );
  const [msg, setMsg]             = useState<string | null>(null);

  const token = localStorage.getItem("token");
  const API   = import.meta.env.VITE_API_URL;

  async function saveName() {
    if (!name.trim()) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`${API}/users/me`, {
        method:  "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error();
      setMsg("✓ Nombre actualizado");
    } catch {
      setMsg("Error al guardar nombre");
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage(file: File) {
    setUploading(true);
    setMsg(null);

    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    const fd = new FormData();
    fd.append("image", file);

    try {
      const res = await fetch(`${API}/users/me/photo`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
        body:    fd,
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data?.profileImage) setPreview(data.profileImage);
      setMsg("✓ Foto actualizada");
    } catch {
      setMsg("Error al subir foto");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="profile-overlay" onClick={(e) => { if (e.target === e.currentTarget) navigate(-1); }}>
      <div className="profile-card">
        <button className="profile-close" onClick={() => navigate(-1)}>✕</button>

        <h2 className="profile-title">Mi Perfil</h2>

        <div className="profile-avatar-section">
          {preview ? (
            <img src={preview} alt="Perfil" className="profile-avatar-big" />
          ) : (
            <div className="profile-avatar-big-placeholder">
              {name?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); }}
          />
          <button
            className="profile-btn primary"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "Subiendo…" : "Cambiar foto"}
          </button>
        </div>

        <div className="profile-field">
          <label className="profile-label">Nombre</label>
          <input
            className="profile-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre"
            onKeyDown={(e) => e.key === "Enter" && saveName()}
          />
          <button
            className="profile-btn primary"
            onClick={saveName}
            disabled={saving}
            style={{ marginTop: 4 }}
          >
            {saving ? "Guardando…" : "Guardar nombre"}
          </button>
        </div>

        {msg && (
          <p style={{
            fontSize:   "0.82rem",
            color:      msg.startsWith("✓") ? "var(--green)" : "var(--red)",
            textAlign:  "center",
            fontWeight: 500,
            margin:     0,
          }}>
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}
