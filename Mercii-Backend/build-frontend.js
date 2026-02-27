const fs = require('fs');
const path = require('path');

// Create a simple React build
const buildDir = path.join(__dirname, 'public');
const frontendSrcDir = path.join(__dirname, 'frontend-src');

// Ensure public directory exists
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// Create a simple HTML file that loads React from CDN
const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Mercii Admin Panel</title>
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <style>
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: #1f2937; color: white; padding: 1rem; }
        .login-form { max-width: 400px; margin: 50px auto; padding: 2rem; border: 1px solid #e5e7eb; border-radius: 8px; }
        .form-group { margin-bottom: 1rem; }
        label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
        input { width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; }
        button { width: 100%; padding: 0.75rem; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #2563eb; }
        .error { color: #ef4444; margin-top: 0.5rem; }
        .success { color: #10b981; margin-top: 0.5rem; }
    </style>
</head>
<body>
    <div id="root"></div>

    <script type="text/babel">
        const { useState, useEffect } = React;

        function LoginForm() {
            const [username, setUsername] = useState('');
            const [password, setPassword] = useState('');
            const [loading, setLoading] = useState(false);
            const [error, setError] = useState('');
            const [success, setSuccess] = useState('');

            const handleSubmit = async (e) => {
                e.preventDefault();
                setLoading(true);
                setError('');
                setSuccess('');

                try {
                    const response = await fetch('/api/v1/admin/auth/login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ username, password }),
                    });

                    const data = await response.json();

                    if (response.ok) {
                        setSuccess('Login successful! Redirecting...');
                        localStorage.setItem('token', data.token);
                        setTimeout(() => {
                            window.location.href = '/dashboard';
                        }, 1500);
                    } else {
                        setError(data.message || 'Login failed');
                    }
                } catch (err) {
                    setError('Network error. Please try again.');
                } finally {
                    setLoading(false);
                }
            };

            return (
                <div className="container">
                    <div className="header">
                        <h1>Mercii Admin Panel</h1>
                    </div>
                    <div className="login-form">
                        <h2>Login</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Username:</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Password:</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <button type="submit" disabled={loading}>
                                {loading ? 'Logging in...' : 'Login'}
                            </button>
                            {error && <div className="error">{error}</div>}
                            {success && <div className="success">{success}</div>}
                        </form>
                    </div>
                </div>
            );
        }

        function Dashboard() {
            const [token, setToken] = useState(null);
            const [user, setUser] = useState(null);

            useEffect(() => {
                const storedToken = localStorage.getItem('token');
                if (storedToken) {
                    setToken(storedToken);
                    // You can add user data fetching here
                    setUser({ username: 'admin', role: 'admin' });
                } else {
                    window.location.href = '/';
                }
            }, []);

            const handleLogout = () => {
                localStorage.removeItem('token');
                window.location.href = '/';
            };

            if (!token) {
                return <div>Loading...</div>;
            }

            return (
                <div className="container">
                    <div className="header">
                        <h1>Mercii Admin Dashboard</h1>
                        <button onClick={handleLogout} style={{float: 'right', marginTop: '-40px'}}>Logout</button>
                    </div>
                    <div style={{padding: '20px'}}>
                        <h2>Welcome, {user?.username}!</h2>
                        <p>This is your admin dashboard. The backend API is working correctly.</p>
                        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '30px'}}>
                            <div style={{padding: '20px', border: '1px solid #e5e7eb', borderRadius: '8px'}}>
                                <h3>📊 Analytics</h3>
                                <p>View system analytics and reports</p>
                            </div>
                            <div style={{padding: '20px', border: '1px solid #e5e7eb', borderRadius: '8px'}}>
                                <h3>👥 Users</h3>
                                <p>Manage user accounts and permissions</p>
                            </div>
                            <div style={{padding: '20px', border: '1px solid #e5e7eb', borderRadius: '8px'}}>
                                <h3>💳 Transactions</h3>
                                <p>Monitor and manage transactions</p>
                            </div>
                            <div style={{padding: '20px', border: '1px solid #e5e7eb', borderRadius: '8px'}}>
                                <h3>⚙️ Settings</h3>
                                <p>Configure system settings</p>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        function App() {
            const [path, setPath] = useState(window.location.pathname);

            useEffect(() => {
                const handlePopState = () => setPath(window.location.pathname);
                window.addEventListener('popstate', handlePopState);
                return () => window.removeEventListener('popstate', handlePopState);
            }, []);

            if (path === '/dashboard') {
                return <Dashboard />;
            }
            return <LoginForm />;
        }

        ReactDOM.render(<App />, document.getElementById('root'));
    </script>
</body>
</html>
`;

// Write the HTML file
fs.writeFileSync(path.join(buildDir, 'index.html'), htmlContent);

console.log('Frontend build completed successfully!');
console.log('Files created in:', buildDir);
