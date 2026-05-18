import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setAuth } from "../api";
import logo from '../assets/logopip.png';

export default function Login() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { username, password });
      localStorage.setItem("token", data.token);
      localStorage.setItem("rol", data.user.rol);
      localStorage.setItem("nombre", data.user.nombre);
      setAuth(data.token);
      nav("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="card">
        <div className="brand">
          <img src={logo} alt="Logo" className="logo-img" />
          <h2>Control Pipsa</h2>
          <p className="muted">Bienvenido, ingresa tus credenciales</p>
        </div>
        <form className="form" onSubmit={onSubmit}>
          <label>Usuario</label>
          <input
            type="text"
            placeholder="tu.usuario"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            autoComplete="username"
          />
          <label>Contraseña</label>
          <div className="pass">
            <input
              type={show ? "text" : "password"}
              placeholder="Ingresa tu contraseña"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="ghost"
              onClick={() => setShow(s => !s)}
              aria-label="Mostrar/ocultar contraseña"
            />
          </div>
          {error && <p className="alert">{error}</p>}
          <button className="btn primary" disabled={loading}>
            {loading ? "Cargando..." : "Iniciar Sesión"}
          </button>
        </form>
      </div>
    </div>
  );
}