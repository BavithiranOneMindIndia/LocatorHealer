interface ProjectItem {
  id: string;
  name: string;
  createdAt: string;
}

interface Props {
  projects: ProjectItem[];
  activeProjectId: string | null;
  newProjectName: string;
  onNewProjectNameChange: (v: string) => void;
  onCreateProject: () => Promise<void>;
  onSelectProject: (projectId: string) => Promise<void>;
}

export function ProjectPage({ projects, activeProjectId, newProjectName, onNewProjectNameChange, onCreateProject, onSelectProject }: Props) {
  return (
    <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, marginBottom: 14 }}>
      <h2>Project Creation</h2>
      <p style={{ color: '#475569' }}>Create a project, then enter its workflow space.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
          value={newProjectName}
          onChange={(e) => onNewProjectNameChange(e.target.value)}
          placeholder="Project name"
        />
        <button onClick={onCreateProject}>Create Project</button>
      </div>

      {projects.length === 0 && <p>No projects yet.</p>}
      {projects.map((project) => (
        <div key={project.id} style={{ border: '1px solid #dbeafe', borderRadius: 8, padding: 10, marginBottom: 8, background: activeProjectId === project.id ? '#eff6ff' : '#fff' }}>
          <strong>{project.name}</strong>
          <div style={{ fontSize: 12, color: '#64748b' }}>Created: {new Date(project.createdAt).toLocaleString()}</div>
          <button style={{ marginTop: 6 }} onClick={() => onSelectProject(project.id)}>
            {activeProjectId === project.id ? 'Selected' : 'Open Project'}
          </button>
        </div>
      ))}
    </section>
  );
}
