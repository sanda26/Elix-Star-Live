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
    
    # Check sudoers
    print("Checking sudoers file...")
    stdin, stdout, stderr = client.exec_command('cat /etc/sudoers')
    sudoers = stdout.read().decode('utf-8', errors='replace')
    print(f"Sudoers file:\n{sudoers}")
    
    # Check if sanda is in sudo group
    print("\nChecking user groups...")
    stdin, stdout, stderr = client.exec_command('groups sanda')
    groups = stdout.read().decode('utf-8', errors='replace')
    print(f"User groups: {groups}")
    
    client.close()
    
except Exception as e:
    print(f"Error: {e}")