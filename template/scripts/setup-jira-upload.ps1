# One-time set-up for ticket attachments: saves your Atlassian email and API token as user environment variables.
# Run it in your own PowerShell. The token is typed hidden and is never printed or sent anywhere except by attach.mjs
# to your Atlassian site. Create the token first: Atlassian account > Security > API tokens.
$email = Read-Host 'Atlassian email'
$secure = Read-Host 'Atlassian API token (typed hidden)' -AsSecureString
$token = [Net.NetworkCredential]::new('', $secure).Password
if (-not $email -or -not $token) {
    Write-Host 'Nothing saved: the email or the token was empty.' -ForegroundColor Yellow
    return
}
setx JIRA_EMAIL $email | Out-Null
setx JIRA_API_TOKEN $token | Out-Null
Write-Host 'Saved JIRA_EMAIL and JIRA_API_TOKEN for your Windows user. Go back to Claude and say it is done.' -ForegroundColor Green
