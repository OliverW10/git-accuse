window.onload = async ()=>{
    let usersDiv = document.getElementById("users");
    let pageUrl = await getPageUrl();
    console.log(pageUrl);
    if(pageUrl == undefined){
        usersDiv.innerHTML = "Could not get current page url";
    }
    if(!pageUrl.includes("github.com")){
        usersDiv.innerHTML = "Current page is not github";
        return;
    }
    if(!pageUrl.includes("#L")){
        usersDiv.innerHTML = "Select a line by clicking on the line number to view blame";
        return;
    }
    let [, user, repo,, branch, ...path] = pageUrl.split("github.com")[1].split("/")
    let [file, line] = path[path.length-1].split("#L")
    let commitHash = await getBlameCommit(user, repo, branch, path, Number(line));
    let prNum = await getPullRequest(user, repo, commitHash);
    let reviewers = await getApprovingReviwers(user, repo, prNum);
    let authors = await getPreviousCommit(user, repo, commitHash)
};


// async function getSelected(){
//     return chrome.tabs.executeScript({code: "window.getSelection().toString();"})[0];
// }

// is a github page with a single line selected
async function getPageUrl(){
    let queryOptions = { active: true, currentWindow: true };
    // `tab` will either be a `tabs.Tab` instance or `undefined`.
    let tabs = await chrome.tabs.query(queryOptions);
    let [tab] = tabs;
    return tab.url;
}

function hasLineSelected(url){
    return ;
}

// const blameQuery = `{
//     # repository name/owner
//     repository(name: "opencv", owner: "opencv") {
//       # branch name
//       ref(qualifiedName:"master") {
//         target {
//           # cast Target to a Commit
//           ... on Commit {
//             # full repo-relative path to blame file
//             blame(path:"include/opencv2/opencv.hpp") {
//               ranges {
//                 commit {
//                   author {
//                     name
//                   }
//                 }
//                 startingLine
//                 endingLine
//                 age
//               }
//             }
//           }
//         }
//       }
// }`
async function getBlameCommit(user, repo, branch, path, line){
    let response = await fetch(`https://github.com/${user}/${repo}/blame/${branch}/${path.join("/")}`);
    let result = await response.json();
    console.log(result)
    let ranges = result.payload.blame.ranges;
    for(let startLineStr in ranges){
        let startLine = Number(startLineStr);
        let range = ranges[startLine];
        if(range.end >= line){
            return JSON.parse(JSON.stringify(ranges[startLine])).commitOid;
        }
    }
    return Promise.reject("couldnt find line");
}

async function getPreviousCommit(user, repo, commit_hash){
    let response = await fetch(`https://api.github.com/repos/${user}/${repo}/commits/${commit_hash}`);
    let result = await response.json();
    console.log(result)
}

async function getPullRequest(user, repo, commit_hash){
    let response = await fetch(`https://api.github.com/repos/${user}/${repo}/commits/${commit_hash}/pulls`)
    let result = await response.json();
    console.log(result[0].number);
    return result[0].number;
}

async function getApprovingReviwers(user, repo, pr_num){
    let response = await fetch(`https://api.github.com/repos/${user}/${repo}/pulls/${pr_num}/reviews`)
    let result = await response.json();
    return result.map(r => {
        return {img: r.user.avatar_url, name: r.user.login}
    });
}
