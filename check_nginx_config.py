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
    
    # Check Nginx configuration
    print("Checking Nginx configuration...")
    stdin, stdout, stderr = client.exec_command('cat /etc/nginx/sites-available/elixstarlive.co.uk')
    config = stdout.read().decode('utf-8', errors='replace')
    print(config)
    
    # Check enabled sites
    print("\nChecking enabled sites...")
    stdin, stdout, stderr = client.exec_command('ls -la /etc/nginx/sites-enabled/')
    sites = stdout.read().decode('utf-8', errors='replace')
    print(sites)
    
    # Check SSL certificate
    print("\nChecking SSL certificate...")
    stdin, stdout, stderr = client.exec_command('sudo certbot certificates 2>/dev/null')
    certs = stdout.read().decode('utf-8', errors='replace')
    print(certs)
    
    client.close()
    
except Exception as e:
    print(f"Error: {e}")