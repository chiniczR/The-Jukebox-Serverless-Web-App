var at;

var poolData = {
    UserPoolId: _config.cognito.userPoolId,
    ClientId: _config.cognito.userPoolClientId
};

var userPool, authToken, username;

function changeLoginBtn() {
    var loginBtn = document.getElementById('loginBtn')
    loginBtn.textContent = 'Logout  '
    var icon = document.createElement('i')
    icon.classList.add('fas', 'fa-sign-out-alt')
    loginBtn.appendChild(icon)
    loginBtn.onclick = (event) => {
        event.preventDefault();
        loginBtn.outerHTML = '<a class="nav-link text-dark" id="loginBtn" href="./login.html">Login <i class="fas fa-sign-in-alt"></i></a>'
        signOut();
    }
}

if (!(_config.cognito.userPoolId &&
    _config.cognito.userPoolClientId &&
    _config.cognito.region)) {
    alert("Amazon Cognito is not configured!")
}
else {
    userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

    if (typeof AWSCognito !== 'undefined') {
        AWSCognito.config.region = _config.cognito.region;
    }

    function signOut() {
        userPool.getCurrentUser().signOut();
    };

    authToken = new Promise(function fetchCurrentAuthToken(resolve, reject) {
        var cognitoUser = userPool.getCurrentUser();
        if (cognitoUser) {
            if (cognitoUser.username) {
                // alert('Found user: ' + cognitoUser.username)
                username = cognitoUser.username
            }
            cognitoUser.getSession(function sessionCallback(err, session) {
                if (err) {
                    reject(err);
                } else if (!session.isValid()) {
                    resolve(null);
                } else {
                    resolve(session.getIdToken().getJwtToken());
                }
            });
        } else {
            resolve(null);
        }
    });
    authToken.then(function setAuthToken(token) {
        if (token) {
            at = token
            setTimeout(() => {
                changeLoginBtn()
                document.getElementById('signupBtn').classList.add('disabled')
                document.getElementById('signupBtn').onclick = (event) => { event.preventDefault(); }
                document.getElementById('signupBtn').setAttribute("data-toggle", "tooltip")
                document.getElementById('signupBtn').setAttribute("title", "You are currently logged in!")
                document.getElementById('greeting').textContent = 'Logged in as ' + username
            }, 100);
        }
    }).catch(function handleTokenError(error) {
        alert(error);
        window.location.assign('./login.html');
    });
}
