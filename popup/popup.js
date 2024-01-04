window.onload = async ()=>{
    let messageDiv = document.getElementById("message");

    const message = (msg)=>{
        messageDiv.textContent = msg;
    }

    // should be a github page with a single line selected
    let pageUrl = await getPageUrl();
    
    if(pageUrl == undefined){
        message("Could not get current page url");
        return;
    }
    if(!pageUrl.includes("github.com")){
        message("Current page is not github");
        return;
    }
    if(!pageUrl.includes("#L")){
        message("Select a line by clicking on the line number to view blame");
        return;
    }

    let [, user, repo,, branch, ...path] = pageUrl.split("github.com")[1].split("/")
    let [file, line] = path[path.length-1].split("#L")
    message("Getting first blame");
    let blame = await getBlame(user, repo, branch, path);
    let commitHash = getLineBlameCommitHash(blame, Number(line));
    message("Getting reviwers");
    let prNum = await getPullRequest(user, repo, commitHash);
    let reviewers = await getApprovingReviwers(user, repo, prNum);
    message("Getting previous authors");
    let allAuthors = await getPreviousAuthors(blame, user, repo, path, commitHash, line);
    
    createPage(messageDiv, reviewers, allAuthors);
};

function createPage(div, reviewers, authors){
    console.log(reviewers);
    console.log(authors);
    div.innerText = ``;
    let reviewersTitle = document.createElement("h3");
    reviewersTitle.textContent = "Responsible Reviewers";
    div.appendChild(reviewersTitle);
    div.appendChild(document.createElement("hr"));
    for(let user of [...new Set(reviewers)]){
        createRow(div, user);
    }

    let authorsTitle = document.createElement("h3");
    authorsTitle.textContent = "Responsible Authors";
    div.appendChild(authorsTitle);
    div.appendChild(document.createElement("hr"));
    for(let user of [...new Set(authors)]){
        createRow(div, user);
    }
}

function createRow(div, user){
    console.log(user);
    let rowDiv = document.createElement("div");
    rowDiv.className = "rowDiv"
    let img = document.createElement("img");
    img.src = user.img;
    rowDiv.appendChild(img);

    let text = document.createElement("p");
    text.innerText = user.name;
    rowDiv.appendChild(text);

    div.appendChild(rowDiv);
}


async function getPageUrl(){
    let queryOptions = { active: true, currentWindow: true };
    // `tab` will either be a `tabs.Tab` instance or `undefined`.
    let tabs = await chrome.tabs.query(queryOptions);
    let [tab] = tabs;
    return tab.url;
}

async function getBlame(user, repo, branch, path){
    let response = await fetch(`https://github.com/${user}/${repo}/blame/${branch}/${path.join("/")}`);
    return await response.json();
}

function getLineBlameCommitHash(blameResponse, line){
    let ranges = blameResponse.payload.blame.ranges;
    for(let startLineStr in ranges){
        let startLine = Number(startLineStr);
        let range = ranges[startLine];
        if(range.end >= line){
            return JSON.parse(JSON.stringify(ranges[startLine].commitOid));
        }
    }
    return Promise.reject("couldnt find line");
}

function getBlameCommitUser(blameResponse, commitHash){
    let commit = blameResponse.payload.blame.commits[commitHash];
    return {name: commit.commiterName, img: commit.authorAvatarUrl};
}

async function getCommit(user, repo, commit_hash){
    let response = await fetch(`https://api.github.com/repos/${user}/${repo}/commits/${commit_hash}`);
    let result = await response.json();
    return result;
}

async function getPullRequest(user, repo, commit_hash){
    let response = await fetch(`https://api.github.com/repos/${user}/${repo}/commits/${commit_hash}/pulls`)
    let result = await response.json();
    return result[0].number;
}

async function getApprovingReviwers(user, repo, pr_num){
    let response = await fetch(`https://api.github.com/repos/${user}/${repo}/pulls/${pr_num}/reviews`)
    let result = await response.json();
    return result.map(r => {
        return {img: r.user.avatar_url, name: r.user.login}
    });
}

async function getPreviousAuthors(blame, user, repo, path, commitHash, line){
    let authors = [];

    for(let i = 0; i < 3; i++){
        // Get the commit data to get the parent commit hash
        let commit = await getCommit(user, repo, commitHash);
        authors.push( {img: commit.author.avatar_url, name: commit.author.login} );

        if(commit.parents.length == 0){
            break;
        }
        let parentCommitHash = commit.parents[0].sha;

        // Get the blame for the parent commit to get the last commit on the line
        blame = await getBlame(user, repo, parentCommitHash, path, line);
        commitHash = getLineBlameCommitHash(blame, line);
    }
    return authors;
}