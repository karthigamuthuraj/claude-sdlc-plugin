# One-time set-up for ticket attachments: saves your Atlassian site, email and API token as user environment variables.
# Run it in your own PowerShell. The token is typed hidden and is never printed. It is saved with the in-process .NET call
# (not setx), so it never appears on a process command line. attach.mjs sends it only to the site saved here.
# Create the token first: Atlassian account > Security > API tokens.
$site = Read-Host 'Jira site address, for example https://yourteam.atlassian.net'
$email = Read-Host 'Atlassian email'
$secure = Read-Host 'Atlassian API token (typed hidden)' -AsSecureString
$token = [Net.NetworkCredential]::new('', $secure).Password
$uri = $null
if (-not [Uri]::TryCreate($site, [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -ne 'https') {
    Write-Host 'Nothing saved: the site must be a full https address.' -ForegroundColor Yellow
    return
}
if (-not $email -or -not $token) {
    Write-Host 'Nothing saved: the email or the token was empty.' -ForegroundColor Yellow
    return
}
[Environment]::SetEnvironmentVariable('JIRA_BASE_URL', $uri.GetLeftPart([UriPartial]::Authority), 'User')
[Environment]::SetEnvironmentVariable('JIRA_EMAIL', $email, 'User')
[Environment]::SetEnvironmentVariable('JIRA_API_TOKEN', $token, 'User')
Write-Host 'Saved JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN for your Windows user. Go back to Claude and say it is done.' -ForegroundColor Green
