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
    
    # Check Nginx sites
    print("Checking Nginx sites...")
    stdin, stdout, stderr = client.exec_command('ls -la /etc/nginx/sites-enabled/')
    print("Nginx sites:")
    print(stdout.read().decode('utf-8', errors='replace'))
    
    # Check Nginx status
    print("\nChecking Nginx status...")
    stdin, stdout, stderr = client.exec_command('systemctl is-active nginx')
    status = stdout.read().decode('utf-8', errors='replace').strip()
    print(f"Nginx is active: {status}")
    
    # Check application on port 8080
    print("\nChecking application on port 8080...")
    stdin, stdout, stderr = client.exec_command('curl -s http://localhost:8080/health')
    print("Application health check:")
    print(stdout.read().decode('utf-8', errors='replace'))
    
    # Check if default Nginx page is being served
    print("\nChecking Nginx default page...")
    stdin, stdout, stderr = client.exec_command('curl -s http://localhost')
    print("Nginx default page:")
    print(stdout.read().decode('utf-8', errors='replace'))
    
    client.close()
    
except Exception as e:
    print(f"Error: {e}")