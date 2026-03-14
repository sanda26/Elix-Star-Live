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
    
    # Check if all files exist
    print("Checking if all files exist...")
    files_to_check = [
        '/home/sanda/elix-star-live/dist/index.html',
        '/home/sanda/elix-star-live/dist/favicon.svg',
        '/home/sanda/elix-star-live/dist/manifest.json',
        '/home/sanda/elix-star-live/dist/assets/',
        '/home/sanda/elix-star-live/dist/Icons/'
    ]
    
    for file in files_to_check:
        stdin, stdout, stderr = client.exec_command(f'test -e "{file}" && echo "exists" || echo "not found"')
        exists = stdout.read().decode('utf-8', errors='replace').strip()
        print(f"{file}: {exists}")
    
    # Check directory permissions
    print("\nChecking directory permissions...")
    stdin, stdout, stderr = client.exec_command('namei -l /home/sanda/elix-star-live/dist/index.html')
    namei = stdout.read().decode('utf-8', errors='replace')
    print(f"Path permissions:\n{namei}")
    
    # Try serving the file directly with Nginx
    print("\nTesting direct file access...")
    shell = client.invoke_shell()
    import time
    time.sleep(1)
    
    # Use sudo to run as www-data
    shell.send('sudo -u www-data cat /home/sanda/elix-star-live/dist/index.html | head -5\n')
    time.sleep(2)
    output = shell.recv(2000).decode('utf-8', errors='replace')
    if 'password' in output.lower():
        shell.send(password + '\n')
        time.sleep(2)
        output = shell.recv(2000).decode('utf-8', errors='replace')
    print(f"www-data can read index.html: {output}")
    
    shell.close()
    
    # Check if there's a .htaccess or other config interfering
    print("\nChecking for config files...")
    stdin, stdout, stderr = client.exec_command('ls -la /home/sanda/elix-star-live/dist/ | grep -E "\.(htaccess|conf|config)"')
    configs = stdout.read().decode('utf-8', errors='replace')
    print(f"Config files: {configs}")
    
    # Check parent directory permissions
    print("\nChecking parent directory permissions...")
    stdin, stdout, stderr = client.exec_command('ls -la /home/sanda/ | grep elix-star-live')
    parent = stdout.read().decode('utf-8', errors='replace')
    print(f"Parent directory: {parent}")
    
    client.close()
    
except Exception as e:
    print(f"Error: {e}")