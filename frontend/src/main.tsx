import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'

// Note: StrictMode is intentionally NOT used here. In development, StrictMode
// deliberately mounts -> unmounts -> re-mounts every component once, to help
// catch bugs. That's fine for most UI, but it's actively harmful for our
// useWebRTC hook: it would request the camera, connect to the signaling
// server, and join the room TWICE in quick succession, which causes exactly
// the kind of "I only see my own video" failure you're hitting.
createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
)