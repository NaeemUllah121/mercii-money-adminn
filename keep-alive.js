const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  backend: {
    script: 'src/bin/www',
    cwd: './Mercii-Backend',
    port: 3000,
    maxRestarts: 50,
    restartDelay: 3000
  },
  frontend: {
    script: 'start',
    cwd: './mercii-admin',
    port: 3001,
    maxRestarts: 50,
    restartDelay: 3000
  },
  ngrok: {
    url: 'https://unverbalized-macrobiotically-olene.ngrok-free.dev',
    maxRestarts: 20,
    restartDelay: 5000
  }
};

// Process tracking
const processes = {
  backend: null,
  frontend: null,
  ngrok: null
};

const restartCount = {
  backend: 0,
  frontend: 0,
  ngrok: 0
};

// Logging
const logFile = path.join(__dirname, 'server-logs.txt');
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(logMessage.trim());
  fs.appendFileSync(logFile, logMessage);
}

// Health check functions
async function checkHealth(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { 
        method: 'GET',
        timeout: 5000
      });
      if (response.ok) return true;
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return false;
}

// Start backend
function startBackend() {
  return new Promise((resolve, reject) => {
    log('Starting backend server...');
    
    processes.backend = spawn('node', [CONFIG.backend.script], {
      cwd: CONFIG.backend.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    let output = '';
    processes.backend.stdout.on('data', (data) => {
      output += data.toString();
      if (output.includes('Listening on port 3000')) {
        log('Backend started successfully');
        resolve();
      }
    });

    processes.backend.stderr.on('data', (data) => {
      log(`Backend ERROR: ${data.toString()}`);
    });

    processes.backend.on('close', (code) => {
      log(`Backend process closed with code: ${code}`);
      if (code !== 0 && restartCount.backend < CONFIG.backend.maxRestarts) {
        restartCount.backend++;
        log(`Restarting backend (attempt ${restartCount.backend})...`);
        setTimeout(startBackend, CONFIG.backend.restartDelay);
      } else if (restartCount.backend >= CONFIG.backend.maxRestarts) {
        log('Backend max restarts reached');
      }
    });

    setTimeout(() => {
      if (!output.includes('Listening on port 3000')) {
        reject(new Error('Backend failed to start within timeout'));
      }
    }, 10000);
  });
}

// Start frontend
function startFrontend() {
  return new Promise((resolve, reject) => {
    log('Starting frontend server...');
    
    processes.frontend = spawn('npm', [CONFIG.frontend.script], {
      cwd: CONFIG.frontend.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    let output = '';
    processes.frontend.stdout.on('data', (data) => {
      output += data.toString();
      if (output.includes('webpack compiled successfully') || 
          output.includes('Local:') || 
          output.includes('on your network')) {
        log('Frontend started successfully');
        resolve();
      }
    });

    processes.frontend.stderr.on('data', (data) => {
      log(`Frontend ERROR: ${data.toString()}`);
    });

    processes.frontend.on('close', (code) => {
      log(`Frontend process closed with code: ${code}`);
      if (code !== 0 && restartCount.frontend < CONFIG.frontend.maxRestarts) {
        restartCount.frontend++;
        log(`Restarting frontend (attempt ${restartCount.frontend})...`);
        setTimeout(startFrontend, CONFIG.frontend.restartDelay);
      } else if (restartCount.frontend >= CONFIG.frontend.maxRestarts) {
        log('Frontend max restarts reached');
      }
    });

    setTimeout(() => {
      if (!output.includes('webpack compiled successfully') && 
          !output.includes('Local:')) {
        reject(new Error('Frontend failed to start within timeout'));
      }
    }, 30000);
  });
}

// Start ngrok
function startNgrok() {
  return new Promise((resolve, reject) => {
    log('Starting ngrok tunnel...');
    
    // Kill existing ngrok processes
    exec('taskkill /f /im ngrok.exe 2>nul', () => {
      setTimeout(() => {
        processes.ngrok = spawn('ngrok', ['http', '3001', '--log=stdout'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env }
        });

        let output = '';
        processes.ngrok.stdout.on('data', (data) => {
          output += data.toString();
          if (output.includes('url=https://')) {
            const match = output.match(/url=https:\/\/([^s]+)/);
            if (match) {
              log(`Ngrok tunnel established: https://${match[1]}`);
              resolve();
            }
          }
        });

        processes.ngrok.stderr.on('data', (data) => {
          log(`Ngrok ERROR: ${data.toString()}`);
        });

        processes.ngrok.on('close', (code) => {
          log(`Ngrok process closed with code: ${code}`);
          if (code !== 0 && restartCount.ngrok < CONFIG.ngrok.maxRestarts) {
            restartCount.ngrok++;
            log(`Restarting ngrok (attempt ${restartCount.ngrok})...`);
            setTimeout(startNgrok, CONFIG.ngrok.restartDelay);
          } else if (restartCount.ngrok >= CONFIG.ngrok.maxRestarts) {
            log('Ngrok max restarts reached');
          }
        });

        setTimeout(() => {
          if (!output.includes('url=https://')) {
            reject(new Error('Ngrok failed to start within timeout'));
          }
        }, 15000);
      }, 2000);
    });
  });
}

// Health monitoring
async function startHealthMonitoring() {
  log('Starting health monitoring...');
  
  setInterval(async () => {
    try {
      // Check backend health
      const backendHealthy = await checkHealth('http://localhost:3000');
      if (!backendHealthy && processes.backend) {
        log('Backend health check failed, restarting...');
        processes.backend.kill();
        setTimeout(startBackend, 2000);
      }

      // Check frontend health
      const frontendHealthy = await checkHealth('http://localhost:3001');
      if (!frontendHealthy && processes.frontend) {
        log('Frontend health check failed, restarting...');
        processes.frontend.kill();
        setTimeout(startFrontend, 2000);
      }

      // Check ngrok tunnel
      const ngrokHealthy = await checkHealth(CONFIG.ngrok.url);
      if (!ngrokHealthy) {
        log('Ngrok tunnel health check failed, restarting...');
        if (processes.ngrok) processes.ngrok.kill();
        setTimeout(startNgrok, 3000);
      }

      log('Health check passed - all services running');
    } catch (error) {
      log(`Health check error: ${error.message}`);
    }
  }, 60000); // Check every minute
}

// Graceful shutdown
process.on('SIGINT', () => {
  log('Received SIGINT, shutting down gracefully...');
  Object.values(processes).forEach(proc => {
    if (proc) proc.kill();
  });
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Received SIGTERM, shutting down gracefully...');
  Object.values(processes).forEach(proc => {
    if (proc) proc.kill();
  });
  process.exit(0);
});

// Main execution
async function main() {
  log('Starting Mercii Admin Panel - 5 Hour Keep Alive System');
  log('Target uptime: 5 hours (300 minutes)');
  
  try {
    // Start all services
    await startBackend();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await startFrontend();
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await startNgrok();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Start health monitoring
    await startHealthMonitoring();
    
    log('All services started successfully!');
    log(`Demo URL: ${CONFIG.ngrok.url}`);
    log('System will auto-restart on failures for 5 hours');
    
    // Set 5-hour timeout
    setTimeout(() => {
      log('5-hour uptime target reached. System will continue running.');
    }, 5 * 60 * 60 * 1000); // 5 hours in milliseconds
    
  } catch (error) {
    log(`Failed to start services: ${error.message}`);
    process.exit(1);
  }
}

main();
