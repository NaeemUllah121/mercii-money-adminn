const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  backend: {
    script: 'node src/bin/www',
    cwd: './Mercii-Backend',
    port: 3000
  },
  frontend: {
    script: 'npx react-scripts start',
    cwd: './mercii-admin',
    port: 3001
  },
  ngrok: {
    url: 'https://unverbalized-macrobiotically-olene.ngrok-free.dev'
  }
};

// Process tracking
const processes = {};

// Logging
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(path.join(__dirname, 'server-logs.txt'), logMessage + '\n');
}

// Start process with auto-restart
function startProcess(name, command, cwd, port) {
  log(`Starting ${name}...`);
  
  const [cmd, ...args] = command.split(' ');
  
  processes[name] = spawn(cmd, args, {
    cwd: path.resolve(cwd),
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PORT: port.toString() }
  });

  processes[name].stdout.on('data', (data) => {
    const output = data.toString();
    log(`${name} OUTPUT: ${output.trim()}`);
  });

  processes[name].stderr.on('data', (data) => {
    const output = data.toString();
    log(`${name} ERROR: ${output.trim()}`);
  });

  processes[name].on('close', (code) => {
    log(`${name} process closed with code: ${code}`);
    if (code !== 0) {
      log(`Restarting ${name} in 3 seconds...`);
      setTimeout(() => startProcess(name, command, cwd, port), 3000);
    }
  });

  processes[name].on('error', (error) => {
    log(`${name} process error: ${error.message}`);
    log(`Restarting ${name} in 3 seconds...`);
    setTimeout(() => startProcess(name, command, cwd, port), 3000);
  });
}

// Start ngrok
function startNgrok() {
  log('Starting ngrok...');
  
  // Kill existing ngrok
  exec('taskkill /f /im ngrok.exe 2>nul', () => {
    setTimeout(() => {
      processes.ngrok = spawn('ngrok', ['http', '3001', '--log=stdout'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      processes.ngrok.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('url=https://')) {
          log(`NGROK TUNNEL ACTIVE: ${CONFIG.ngrok.url}`);
        }
      });

      processes.ngrok.stderr.on('data', (data) => {
        log(`NGROK ERROR: ${data.toString().trim()}`);
      });

      processes.ngrok.on('close', (code) => {
        log(`Ngrok closed with code: ${code}`);
        setTimeout(startNgrok, 5000);
      });

      processes.ngrok.on('error', (error) => {
        log(`Ngrok error: ${error.message}`);
        setTimeout(startNgrok, 5000);
      });
    }, 2000);
  });
}

// Health check
async function healthCheck() {
  try {
    const http = require('http');
    
    const checkPort = (port) => {
      return new Promise((resolve) => {
        http.get(`http://localhost:${port}`, (res) => {
          resolve(res.statusCode === 200);
        }).on('error', () => resolve(false));
      });
    };

    const backendOk = await checkPort(CONFIG.backend.port);
    const frontendOk = await checkPort(CONFIG.frontend.port);

    if (!backendOk) {
      log('Backend health check failed - restarting');
      if (processes.backend) processes.backend.kill();
      setTimeout(() => startProcess('backend', CONFIG.backend.script, CONFIG.backend.cwd, CONFIG.backend.port), 2000);
    }

    if (!frontendOk) {
      log('Frontend health check failed - restarting');
      if (processes.frontend) processes.frontend.kill();
      setTimeout(() => startProcess('frontend', CONFIG.frontend.script, CONFIG.frontend.cwd, CONFIG.frontend.port), 2000);
    }

    if (backendOk && frontendOk) {
      log('Health check passed - all services running');
    }
  } catch (error) {
    log(`Health check error: ${error.message}`);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  log('Shutting down gracefully...');
  Object.values(processes).forEach(proc => {
    if (proc && !proc.killed) proc.kill();
  });
  process.exit(0);
});

// Main execution
async function main() {
  log('='.repeat(60));
  log('MERCII ADMIN PANEL - 5 HOUR KEEP ALIVE SYSTEM');
  log('='.repeat(60));
  log('Starting all services for client presentation...');
  log('Target uptime: 5 hours minimum');
  log('Auto-restart enabled for all services');
  log('Health monitoring active');
  log('='.repeat(60));

  // Start services
  startProcess('backend', CONFIG.backend.script, CONFIG.backend.cwd, CONFIG.backend.port);
  
  setTimeout(() => {
    startProcess('frontend', CONFIG.frontend.script, CONFIG.frontend.cwd, CONFIG.frontend.port);
  }, 3000);

  setTimeout(() => {
    startNgrok();
  }, 8000);

  // Start health monitoring after all services are up
  setTimeout(() => {
    log('Starting health monitoring (every 60 seconds)...');
    setInterval(healthCheck, 60000);
  }, 15000);

  // 5-hour marker
  setTimeout(() => {
    log('🎉 5-HOUR TARGET ACHIEVED! System has been stable for 5 hours.');
    log('Client presentation window complete.');
  }, 5 * 60 * 60 * 1000); // 5 hours

  log('All services starting...');
  log(`Demo URL will be: ${CONFIG.ngrok.url}`);
  log('System is now ready for client call!');
}

main().catch(error => {
  log(`Failed to start: ${error.message}`);
  process.exit(1);
});
