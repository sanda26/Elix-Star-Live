import paramiko

# SSH connection details
hostname = '89.167.107.174'
username = 'sanda'
password = 'Cenad1986?!'

try:
    # Create SSH client
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    # Connect to server
    client.connect(hostname, username=username, password=password, timeout=10)
    
    # Check backend status
    print("Checking backend status...")
    stdin, stdout, stderr = client.exec_command('ps aux | grep -E "(node|npm|pm2)" | grep -v grep')
    backend = stdout.read().decode('utf-8', errors='replace')
    print(f"Backend processes:\n{backend}")
    
    # Check if backend is running on port 8080
    print("\nChecking port 8080...")
    stdin, stdout, stderr = client.exec_command('netstat -tlnp | grep 8080')
    port = stdout.read().decode('utf-8', errors='replace')
    print(f"Port 8080:\n{port}")
    
    # Test backend directly
    print("\nTesting backend directly...")
    stdin, stdout, stderr = client.exec_command('curl -s http://localhost:8080/health')
    backend_health = stdout.read().decode('utf-8', errors='replace')
    print(f"Backend health: {backend_health}")
    
    # Check Nginx error logs
    print("\nChecking Nginx error logs...")
    stdin, stdout, stderr = client.exec_command('sudo tail -20 /var/log/nginx/error.log')
    errors = stdout.read().decode('utf-8', errors='replace')
    print(f"Nginx errors:\n{errors}")
    
    # Check Nginx access logs
    print("\nChecking Nginx access logs...")
    stdin, stdout, stderr = client.exec_command('sudo tail -20 /var/log/nginx/access.log')
    access = stdout.read().decode('utf-8', errors='replace')
    print(f"Nginx access:\n{access}")
    
    # Check dist folder permissions
    print("\nChecking dist folder permissions...")
    stdin, stdout, stderr = client.exec_command('ls -la /home/sanda/elix-star-live/dist/ | head -5')
    perms = stdout.read().decode('utf-8', errors='replace')
    print(f"Dist folder permissions:\n{perms}")
    
    # Check Nginx worker user
    print("\nChecking Nginx worker user...")
    stdin, stdout, stderr = client.exec_command('ps aux | grep nginx | grep worker')
    nginx_worker = stdout.read().decode('utf-8', errors='replace')
    print(f"Nginx worker:\n{nginx_worker}")
    
    client.close()
    
except Exception as e:
    print(f"Error: {e}")