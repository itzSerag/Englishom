// ecosystem.config.js
require('dotenv').config(); 

module.exports = {
  apps: [{

    // PM2 Application Configuration
    name: 'main',
    script: 'dist/main.js',
    instances: 2, // or 'max'
    exec_mode: 'cluster',
    
    // PM2 will automatically set instance vars
    instance_var: 'INSTANCE_ID',
    
    env: {
      // Add PM2-specific vars
      PM2_CLUSTER_MODE: 'true',
      INSTANCES: 4,
    },
  }]
};