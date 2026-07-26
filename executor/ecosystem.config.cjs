module.exports = {
  apps: [
    {
      name: "payroutine-executor",
      script: "npm",
      args: "run start",
      cwd: __dirname,
      autorestart: true,
      watch: false,
      max_memory_restart: "350M",
      env: {
        NODE_ENV: "production",
      },
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      merge_logs: true,
      time: true,
    },
  ],
};
