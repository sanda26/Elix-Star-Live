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
    
    # Check all Nginx logs
    print("Checking all Nginx logs...")
    logs = [
        '/var/log/nginx/error.log',
        '/var/log/nginx/access.log',
        '/var/log/nginx/localhost.error.log',
        '/var/log/nginx/localhost.access.log'
    ]
    
    for log in logs:
        stdin, stdout, stderr = client.exec_command(f'sudo cat {log} 2>/dev/null || echo "File not found"')
        content = stdout.read().decode('utf-8', errors='replace')
        if content and "not found" not in content.lower():
            print(f"\n{log}:\n{content}")
    
    # Check system logs
    print("\nChecking system logs...")
    stdin, stdout, stderr = client.exec_command('sudo journalctl -u nginx --no-pager -n 20')
    journal = stdout.read().decode('utf-8', errors='replace')
    if journal:
        print(f"Journalctl output:\n{journal}")
    
    # Check if there are any permission issues on individual files
    print("\nChecking file permissions...")
    stdin, stdout, stderr = client.exec_command('ls -la /home/sanda/elix-star-live/dist/ | head -10')
    files = stdout.read().decode('utf-8', errors='replace')
    print(f"Files:\n{files}")
    
    # Check if nginx can read the directory
    print("\nTesting nginx read access...")
    stdin, stdout, stderr = client.exec_command('sudo -u www-data ls /home/sanda/elix-star-live/dist/ 2>&1 | head -5')
    access = stdout.read().decode('utf-8', errors='replace')
    print(f"www-data access: {access}")
    
    # Check if nginx can read index.html
    print("\nTesting nginx read access to index.html...")
    stdin, stdout, stderr = client.exec_command('sudo -u www-data cat /home/sanda/elix-star-live/dist/index.html 2>&1 | head -5')
    access = stdout.read().decode('utf-8', errors='replace')
    print(f"www-data index.html access: {access}")
    
    # Check Nginx main config
    print("\nChecking Nginx main config...")
    stdin, stdout, stderr = client.exec_command('cat /etc/nginx/nginx.conf | grep -A 5 -B 5 user')
    nginx_conf = stdout.read().decode('utf-8', errors='replace')
    print(f"Nginx user config:\n{nginx_conf}")
    
    client.close()
    
except Exception as e:
    print(f"Error: {e}")