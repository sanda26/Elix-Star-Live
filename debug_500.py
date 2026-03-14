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
    
    # Check Nginx error logs in detail
    print("Checking Nginx error logs...")
    stdin, stdout, stderr = client.exec_command('sudo cat /var/log/nginx/error.log')
    errors = stdout.read().decode('utf-8', errors='replace')
    if errors:
        print(f"Nginx errors:\n{errors}")
    else:
        print("No errors in Nginx log")
    
    # Check Nginx access logs
    print("\nChecking Nginx access logs...")
    stdin, stdout, stderr = client.exec_command('sudo cat /var/log/nginx/access.log')
    access = stdout.read().decode('utf-8', errors='replace')
    if access:
        print(f"Nginx access:\n{access}")
    else:
        print("No access logs")
    
    # Test backend directly
    print("\nTesting backend directly...")
    stdin, stdout, stderr = client.exec_command('curl -s http://localhost:8080/')
    backend_root = stdout.read().decode('utf-8', errors='replace')
    print(f"Backend root: {backend_root[:500]}")
    
    # Test backend health
    print("\nTesting backend health...")
    stdin, stdout, stderr = client.exec_command('curl -s http://localhost:8080/health')
    backend_health = stdout.read().decode('utf-8', errors='replace')
    print(f"Backend health: {backend_health}")
    
    # Test API endpoint
    print("\nTesting API endpoint...")
    stdin, stdout, stderr = client.exec_command('curl -s http://localhost:8080/api/test')
    api_test = stdout.read().decode('utf-8', errors='replace')
    print(f"API test: {api_test}")
    
    # Check index.html file
    print("\nChecking index.html...")
    stdin, stdout, stderr = client.exec_command('cat /home/sanda/elix-star-live/dist/index.html | head -20')
    index = stdout.read().decode('utf-8', errors='replace')
    print(f"Index.html:\n{index}")
    
    # Check Nginx configuration again
    print("\nChecking Nginx configuration...")
    stdin, stdout, stderr = client.exec_command('cat /etc/nginx/sites-available/elixstarlive.co.uk')
    config = stdout.read().decode('utf-8', errors='replace')
    print(f"Nginx config:\n{config}")
    
    # Check if there are any SELinux/AppArmor issues
    print("\nChecking for SELinux/AppArmor...")
    stdin, stdout, stderr = client.exec_command('getenforce 2>/dev/null || echo "SELinux not active"')
    selinux = stdout.read().decode('utf-8', errors='replace')
    print(f"SELinux: {selinux}")
    
    # Check AppArmor
    stdin, stdout, stderr = client.exec_command('aa-status 2>/dev/null || echo "AppArmor not active"')
    apparmor = stdout.read().decode('utf-8', errors='replace')
    print(f"AppArmor: {apparmor}")
    
    # Test with curl verbosely
    print("\nTesting with verbose curl...")
    stdin, stdout, stderr = client.exec_command('curl -v http://localhost 2>&1 | head -30')
    verbose = stdout.read().decode('utf-8', errors='replace')
    print(f"Verbose curl:\n{verbose}")
    
    client.close()
    
except Exception as e:
    print(f"Error: {e}")