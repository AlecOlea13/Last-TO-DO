import { useEffect, useMemo, useState } from "react";
import "../dashboard.css";
import { api, setAuth } from "../api";
import { Link, Outlet } from "react-router-dom";
import {
  cacheTasks,
  getAllTasksLocal,
  putTaskLocal,
  removeTaskLocal,
  queue,
  type OutboxOp,
} from "../offline/db";
import { syncNow, setupOnlineSync } from "../offline/sync";

type Status = "Pendiente" | "En Progreso" | "Completada";

type Task = {
  _id: string;
  title: string;
  description?: string;
  status: Status;
  clienteId?: string;
  createdAt?: string;
  deleted?: boolean;
  pending?: boolean;
};

const isLocalId = (id: string) => !/^[a-f0-9]{24}$/i.test(id);

/** Construye la URL base del servidor sin el segmento /api */
function getBaseUrl(): string {
  const raw = (import.meta.env.VITE_API_URL as string) ?? "";
  return raw.replace(/\/api\/?$/, "");
}

function buildAvatarUrl(profileImage: string): string {
  if (!profileImage) return "";
  if (profileImage.startsWith("http")) return profileImage;
  const base = getBaseUrl();
  const clean = profileImage.replace(/^\//, "");
  // Si el path ya incluye "uploads/" lo usamos directo,
  // si no, lo añadimos porque el backend sirve los archivos ahí
  const path = clean.startsWith("uploads/") ? clean : `uploads/${clean}`;
  return `${base}/${path}`;
}

function normalizeTask(x: any): Task {
  return {
    _id: String(x?._id ?? x?.id),
    title: String(x?.title ?? "(sin título)"),
    description: x?.description ?? "",
    status:
      x?.status === "Completada" ||
      x?.status === "En Progreso" ||
      x?.status === "Pendiente"
        ? x.status
        : "Pendiente",
    clienteId: x?.clienteId,
    createdAt: x?.createdAt,
    deleted: !!x?.deleted,
    pending: !!x?.pending,
  };
}

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string }> = {
  Pendiente:    { label: "Pendiente",   color: "#f59e0b", bg: "rgba(245,158,11,0.12)"  },
  "En Progreso":{ label: "En Progreso", color: "#3b82f6", bg: "rgba(59,130,246,0.12)"  },
  Completada:   { label: "Completada",  color: "#22c55e", bg: "rgba(34,197,94,0.12)"   },
};

export default function Dashboard() {
  const [loading, setLoading]               = useState(true);
  const [tasks, setTasks]                   = useState<Task[]>([]);
  const [title, setTitle]                   = useState("");
  const [description, setDescription]       = useState("");
  const [search, setSearch]                 = useState("");
  const [filter, setFilter]                 = useState<"all" | "active" | "completed">("all");
  const [editingId, setEditingId]           = useState<string | null>(null);
  const [editingTitle, setEditingTitle]     = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [online, setOnline]                 = useState<boolean>(navigator.onLine);
  const [user, setUser]                     = useState<any>(null);

  useEffect(() => {
    setAuth(localStorage.getItem("token"));

    (async () => {
      try {
        const { data } = await api.get("/users/me");
        setUser(data);
      } catch {}
    })();

    const unsubscribe = setupOnlineSync();
    const on = async () => { setOnline(true); await syncNow(); await loadFromServer(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    (async () => {
      const local = await getAllTasksLocal();
      if (local?.length) setTasks(local.map(normalizeTask));
      await loadFromServer();
      await syncNow();
      await loadFromServer();
    })();

    return () => {
      unsubscribe?.();
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  async function loadFromServer() {
    try {
      const { data } = await api.get("/tasks");
      const raw = Array.isArray(data?.items) ? data.items : [];
      const list = raw.map(normalizeTask);
      setTasks(list);
      await cacheTasks(list);
    } catch {}
    finally { setLoading(false); }
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    const d = description.trim();
    if (!t) return;

    const clienteId = crypto.randomUUID();
    const localTask = normalizeTask({ _id: clienteId, title: t, description: d, status: "Pendiente" as Status, pending: !navigator.onLine });
    setTasks((prev) => [localTask, ...prev]);
    await putTaskLocal(localTask);
    setTitle("");
    setDescription("");

    if (!navigator.onLine) {
      await queue({ id: "op-" + clienteId, op: "create", clienteId, data: localTask, ts: Date.now() });
      return;
    }
    try {
      const { data } = await api.post("/tasks", { title: t, description: d });
      const created = normalizeTask(data?.task ?? data);
      setTasks((prev) => prev.map((x) => (x._id === clienteId ? created : x)));
      await putTaskLocal(created);
    } catch {
      await queue({ id: "op-" + clienteId, op: "create", clienteId, data: localTask, ts: Date.now() });
    }
  }

  function startEdit(task: Task) {
    setEditingId(task._id);
    setEditingTitle(task.title);
    setEditingDescription(task.description ?? "");
  }

  async function saveEdit(taskId: string) {
    const newTitle = editingTitle.trim();
    const newDesc  = editingDescription.trim();
    if (!newTitle) return;

    const before  = tasks.find((t) => t._id === taskId);
    const patched = { ...before, title: newTitle, description: newDesc } as Task;
    setTasks((prev) => prev.map((t) => (t._id === taskId ? patched : t)));
    await putTaskLocal(patched);
    setEditingId(null);

    const opData = { title: newTitle, description: newDesc };
    if (!navigator.onLine) {
      await queue({ id: "upd-" + taskId, op: "update", clienteId: isLocalId(taskId) ? taskId : undefined, serverId: isLocalId(taskId) ? undefined : taskId, data: opData, ts: Date.now() } as OutboxOp);
      return;
    }
    try {
      await api.put(`/tasks/${taskId}`, opData);
    } catch {
      await queue({ id: "upd-" + taskId, op: "update", serverId: taskId, data: opData, ts: Date.now() } as OutboxOp);
    }
  }

  async function handleStatusChange(task: Task, newStatus: Status) {
    const updated = { ...task, status: newStatus };
    setTasks((prev) => prev.map((x) => (x._id === task._id ? updated : x)));
    await putTaskLocal(updated);

    const opData = { status: newStatus };
    if (!navigator.onLine) {
      await queue({ id: "upd-" + task._id, op: "update", serverId: isLocalId(task._id) ? undefined : task._id, clienteId: isLocalId(task._id) ? task._id : undefined, data: opData, ts: Date.now() });
      return;
    }
    try {
      await api.put(`/tasks/${task._id}`, opData);
    } catch {
      await queue({ id: "upd-" + task._id, op: "update", serverId: task._id, data: opData, ts: Date.now() });
    }
  }

  async function removeTask(taskId: string) {
    const backup = tasks;
    setTasks((prev) => prev.filter((t) => t._id !== taskId));
    await removeTaskLocal(taskId);

    if (!navigator.onLine) {
      await queue({ id: "del-" + taskId, op: "delete", serverId: isLocalId(taskId) ? undefined : taskId, clienteId: isLocalId(taskId) ? taskId : undefined, ts: Date.now() });
      return;
    }
    try {
      await api.delete(`/tasks/${taskId}`);
    } catch {
      setTasks(backup);
      for (const t of backup) await putTaskLocal(t);
      await queue({ id: "del-" + taskId, op: "delete", serverId: taskId, clienteId: isLocalId(taskId) ? taskId : undefined, ts: Date.now() });
    }
  }

  function logout() {
    localStorage.removeItem("token");
    setAuth(null);
    window.location.href = "/";
  }

  const filtered = useMemo(() => {
    let list = tasks;
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((t) => (t.title || "").toLowerCase().includes(s) || (t.description || "").toLowerCase().includes(s));
    }
    if (filter === "active")    list = list.filter((t) => t.status !== "Completada");
    if (filter === "completed") list = list.filter((t) => t.status === "Completada");
    return list;
  }, [tasks, search, filter]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const done  = tasks.filter((t) => t.status === "Completada").length;
    return { total, done, pending: total - done };
  }, [tasks]);

  const completionPct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <div className="dash-root">
      {/* ── SIDEBAR ── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">🥪</span>
          <div>
            <p className="brand-title">Lonches</p>
            <p className="brand-sub">To-Do PWA</p>
          </div>
        </div>

        {/* User card */}
        <div className="sidebar-user">
          {user?.profileImage ? (
            <img
              src={buildAvatarUrl(user.profileImage)}
              alt={user?.name ?? "Perfil"}
              className="sidebar-avatar"
              onError={(e) => {
                // Si falla la imagen mostramos el placeholder inicial
                const target = e.currentTarget;
                target.style.display = "none";
                const placeholder = target.nextElementSibling as HTMLElement | null;
                if (placeholder) placeholder.style.display = "flex";
              }}
            />
          ) : null}
          <div
            className="sidebar-avatar-placeholder"
            style={{ display: user?.profileImage ? "none" : "flex" }}
          >
            {user?.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="sidebar-user-info">
            <p className="sidebar-user-name">{user?.name ?? "Usuario"}</p>
            <Link to="profile" className="sidebar-profile-link">Editar perfil →</Link>
          </div>
        </div>

        {/* Connection */}
        <div className={`sidebar-connection ${online ? "online" : "offline"}`}>
          <span className="conn-dot" />
          <span>{online ? "En línea" : "Sin conexión"}</span>
        </div>

        {/* Stats */}
        <div className="sidebar-stats">
          <div className="stat-card">
            <p className="stat-num">{stats.total}</p>
            <p className="stat-label">Total</p>
          </div>
          <div className="stat-card">
            <p className="stat-num" style={{ color: "#22c55e" }}>{stats.done}</p>
            <p className="stat-label">Hechas</p>
          </div>
          <div className="stat-card">
            <p className="stat-num" style={{ color: "#f59e0b" }}>{stats.pending}</p>
            <p className="stat-label">Pendientes</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="sidebar-progress">
          <div className="progress-header">
            <span>Progreso</span>
            <span>{completionPct}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${completionPct}%` }} />
          </div>
        </div>

        <div className="sidebar-spacer" />

        <button className="sidebar-logout" onClick={logout}>
          <span>↩</span> Cerrar sesión
        </button>
      </aside>

      {/* ── MAIN ── */}
      <div className="dash-main">
        <Outlet context={{ user }} />

        {/* Add form */}
        <section className="add-section">
          <h2 className="section-title">Nueva tarea</h2>
          <form className="add-form" onSubmit={addTask}>
            <input
              className="add-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="¿Qué necesitas hacer?"
            />
            <textarea
              className="add-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción opcional…"
              rows={2}
            />
            <button className="add-btn" type="submit">
              <span className="add-btn-icon">+</span> Agregar tarea
            </button>
          </form>
        </section>

        {/* Task list */}
        <section className="list-section">
          <div className="list-toolbar">
            <input
              className="search-input"
              placeholder="🔍  Buscar tareas…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="filter-chips">
              {(["all", "active", "completed"] as const).map((f) => (
                <button
                  key={f}
                  className={`filter-chip ${filter === f ? "active" : ""}`}
                  onClick={() => setFilter(f)}
                >
                  {{ all: "Todas", active: "Activas", completed: "Hechas" }[f]}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="spinner" />
              <p>Cargando tareas…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📋</span>
              <p>Sin tareas por aquí</p>
            </div>
          ) : (
            <ul className="task-list">
              {filtered.map((t) => {
                const cfg = STATUS_CONFIG[t.status];
                return (
                  <li
                    key={t._id}
                    className={`task-item ${t.status === "Completada" ? "is-done" : ""}`}
                  >
                    {/* Status pill / select */}
                    <div className="task-status-wrap">
                      <select
                        value={t.status}
                        onChange={(e) => handleStatusChange(t, e.target.value as Status)}
                        className="status-select"
                        style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.color + "55" }}
                      >
                        <option value="Pendiente">Pendiente</option>
                        <option value="En Progreso">En Progreso</option>
                        <option value="Completada">Completada</option>
                      </select>
                    </div>

                    {/* Content */}
                    <div className="task-content">
                      {editingId === t._id ? (
                        <>
                          <input
                            className="edit-input"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            autoFocus
                          />
                          <textarea
                            className="edit-textarea"
                            value={editingDescription}
                            onChange={(e) => setEditingDescription(e.target.value)}
                            rows={2}
                          />
                        </>
                      ) : (
                        <>
                          <p className="task-title" onDoubleClick={() => startEdit(t)}>{t.title}</p>
                          {t.description && <p className="task-desc">{t.description}</p>}
                          {(t.pending || isLocalId(t._id)) && (
                            <span className="sync-badge">⏳ Pendiente de sincronizar</span>
                          )}
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="task-actions">
                      {editingId === t._id ? (
                        <button className="action-save" onClick={() => saveEdit(t._id)}>Guardar</button>
                      ) : (
                        <button className="action-btn edit-btn" onClick={() => startEdit(t)} title="Editar">
                          ✏️
                        </button>
                      )}
                      <button className="action-btn delete-btn" onClick={() => removeTask(t._id)} title="Eliminar">
                        🗑️
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
