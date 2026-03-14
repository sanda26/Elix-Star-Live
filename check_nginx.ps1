$pass = 'Cenad1986?!'
$secPass = ConvertTo-SecureString $pass -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential('sanda', $secPass)
Invoke-Command -ComputerName 89.167.107.174 -Credential $cred -ScriptBlock {
    Write-Host "Checking Nginx sites..."
    ls /etc/nginx/sites-enabled/
    Write-Host "Checking Nginx status..."
    systemctl status nginx
} -ErrorAction SilentlyContinue