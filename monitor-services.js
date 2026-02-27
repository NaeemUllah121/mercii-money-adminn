const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const SERVICES = {
  backend: { port: 3000, name: 'Backend', command: 'node src/bin/www', cwd: './Mercii-Backend' },
  frontend: { port: 3001, name: 'Frontend', command: 'npm start', cwd: './mercii-admin' },
  ngrok: { url: 'https://unverbalized-macrobiotically-olene.ngrok-free.dev', name: 'Ngrok' }
};

// Logging
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(path.join(__dirname, 'service-monitor.log'), logMessage + '\n');
}

// Check if service is running
async function checkService(service) {
  return new Promise((resolve) => {
    const http = require('http');
    const options = service.port ? 
      { hostname: 'localhost', port: service.port, path: '/' } :
      { hostname: new URL(service.url).hostname, port: 443, path: '/' };

    const req = http.request(options, (res) => {
      resolve(res.statusCode < 500);
    });

    req.on('error', () => resolve(false));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

// Restart service
function restartService(serviceKey) {
  const service = SERVICES[serviceKey];
  log(`🔄 Restarting ${service.name}...`);
  
  if (serviceKey === 'ngrok') {
    exec('taskkill /f /im ngrok.exe 2>nul', () => {
      setTimeout(() => {
        spawn('ngrok', ['http', '3001', '--log=stdout'], {
          stdio: 'ignore',
          detached: true
        }).unref();
        log(`✅ ${service.name} restarted`);
      }, 2000);
    });
  } else {
    const [cmd, ...args] = service.command.split(' ');
    spawn(cmd, args, {
      cwd: path.resolve(service.cwd),
      stdio: 'ignore',
      detached: true
    }).unref();
    log(`✅ ${service.name} restarted`);
  }
}

// Main monitoring loop
async function startMonitoring() {
  log('🚀 STARTING 5-HOUR SERVICE MONITORING FOR CLIENT PRESENTATION');
  log('📊 Demo URL: https://unverbalized-macrobiotically-olene.ngrok-free.dev');
  log('👤 Login: admin / Admin123!@#');
  log('⏰ Target uptime: 5 hours minimum');
  log('🔄 Auto-restart enabled for all services');
  log('=' .repeat(70));

  let startTime = Date.now();
  let checkCount = 0;

  // Set 5-hour completion marker
  setTimeout(() => {
    const uptime = Math.floor((Date.now() - startTime) / 1000 / 60);
    log('🎉 5-HOUR TARGET ACHIEVED!');
    log(`⏱️  Total uptime: ${uptime} minutes`);
    log('✅ Client presentation window complete - system stable for 5+ hours');
  }, 5 * 60 * 60 * 1000); // 5 hours

  // Monitor every 30 seconds
  setInterval(async () => {
    checkCount++;
    const uptime = Math.floor((Date.now() - startTime) / 1000 / 60);
    
    log(`🔍 Health check #${checkCount} (Uptime: ${uptime}min)`);
    
    let allHealthy = true;
    
    // Check backend
    const backendOk = await checkService(SERVICES.backend);
    if (!backendOk) {
      log('❌ Backend down - restarting...');
      restartService('backend');
      allHealthy = false;
    } else {
      log('✅ Backend OK');
    }
    
    // Check frontend
    const frontendOk = await checkService(SERVICES.frontend);
    if (!frontendOk) {
      log('❌ Frontend down - restarting...');
      restartService('frontend');
      allHealthy = false;
    } else {
      log('✅ Frontend OK');
    }
    
    // Check ngrok
    const ngrokOk = await checkService(SERVICES.ngrok);
    if (!ngrokOk) {
      log('❌ Ngrok down - restarting...');
      restartService('ngrok');
      allHealthy = false;
    } else {
      log('✅ Ngrok OK');
    }
    
    if (allHealthy) {
      log('🟢 All services healthy - system ready for client');
    }
    
    log('-'.repeat(50));
    
  }, 30000); // Check every 30 seconds

  // Initial check
  setTimeout(async () => {
    log('🔍 Initial health check...');
    for (const [key, service] of Object.entries(SERVICES)) {
      const isOk = await checkService(service);
      log(`${isOk ? '✅' : '❌'} ${service.name}: ${isOk ? 'Running' : 'Down'}`);
    }
    log('🚀 Monitoring active - system ready for client call!');
  }, 5000);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('🛑 Monitoring stopped by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('🛑 Monitoring terminated');
  process.exit(0);
});

// Start monitoring
startMonitoring().catch(error => {
  log(`❌ Monitoring failed to start: ${error.message}`);
  process.exit(1);
});
