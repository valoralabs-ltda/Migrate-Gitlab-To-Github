const moment = require('moment');
const GitlabApi = require('./libs/GitlabApi.js');
const GithubApi = require('./libs/GithubApi.js');
const ArrayUtils = require('./utils/ArrayUtils.js');

module.exports = async function main(ENV_CONFIG)
{
    
    const gitlabApi = new GitlabApi(ENV_CONFIG);
    const githubApi = new GithubApi(ENV_CONFIG);

    repos_loop:
    for (const key in ENV_CONFIG.MIGRATE_REPOS) {
        if (!ENV_CONFIG.MIGRATE_REPOS.hasOwnProperty(key)) return;

        const REPO = ENV_CONFIG.MIGRATE_REPOS[key];
        let project = null;
        let members = [];
        let issues = [];
        let milestones = [];

        try {

            /**
             * Get data from Gitlab
             */
            
            project = await gitlabApi.getProjectData(REPO.gitlab.owner, REPO.gitlab.project_name);
            members = await gitlabApi.getMembers(project.id);
            issues = await gitlabApi.getIssues(project.id);
            milestones = await gitlabApi.getMilestones(project.id);

        } catch (error) {

            console.log(`Repository migration "${REPO.gitlab.project_name}" to Github error!!!`);

            if (error.response && ('data' in error.response)) {
                console.log(`Error: ${error.response.data.message}`);
            } else {
                console.log(error);
            }

            break repos_loop;

        }
    
        /**
         * Process and send data to Github
         */

        console.log(`Processing repository "${project.path_with_namespace}" (${project.description})\n`);

        githubApi.setGitlabProject(project);
        githubApi.setRepository(REPO.github.owner, REPO.github.repo_name);
        githubApi.setUsersNamesakes(REPO.namesake_users);

        const githubMilestonesList = {};

        // Se agregan los "collaborators" al repositorio de Github

        for (const key in members) {
            if (!members.hasOwnProperty(key)) return;

            const index = parseInt(key) + 1;
            const member = members[key];
            //console.log(member);

            try {

                console.log(`Processing collaborator "${member.username}" (${index}/${members.length})`);

                /**
                 * Valid access levels (Gitlab)
                 * ---
                 * 10 => Guest access
                 * 20 => Reporter access
                 * 30 => Developer access
                 * 40 => Maintainer access
                 * 50 => Owner access # Only valid for groups
                 * 
                 * The permission to grant the collaborator (Github)
                 * ---
                 * pull - can pull, but not push to or administer this repository.
                 * push - can pull and push, but not administer this repository.
                 * admin - can pull, push and administer this repository.
                 */

                const memberUserName = githubApi.getNamesakeUser(member.username);
                let memberPermissionLevel;

                switch (member.access_level) {
                    case 30:
                        memberPermissionLevel = 'push';
                        break;
                    case 40:
                        memberPermissionLevel = 'push'; //'pull';
                        break;
                    case 50:
                        memberPermissionLevel = 'push'; //'admin';
                        break;
                    default:
                        memberPermissionLevel = 'push';
                        break;
                }

                if (memberUserName && memberPermissionLevel) {
                    await githubApi.addCollaborator(memberUserName, {
                        "permission": memberPermissionLevel
                    });
                } else {
                    console.log('Error: No match was found\n');
                }

            } catch (error) {

                if (error.response && ('data' in error.response)) {
                    console.log(`Error: ${error.response.data.message}\n`);
                } else {
                    console.log(`${error}\n`);
                }

            }
        }

        // Se migran los "milestones" al repositorio de Github

        for (const key in milestones) {
            if (!milestones.hasOwnProperty(key)) return;

            const index = parseInt(key) + 1;
            const milestone = milestones[key];
            //console.log(milestone);

            try {

                console.log(`Processing milestone "${milestone.title}" (${index}/${milestones.length})`);

                const createdMilestone = await githubApi.createMilestone({
                    "title": milestone.title,
                    "state": milestone.state === 'active' ? 'open' : milestone.state,
                    ...(milestone.description ? {"description": milestone.description} : {}),
                    "due_on": milestone.due_date ? moment(milestone.due_date).format('YYYY-MM-DD[T]HH:mm:ss[Z]') : moment().format('YYYY-MM-DD[T]HH:mm:ss[Z]')
                });
    
                githubMilestonesList[milestone.id] = createdMilestone.data;

            } catch (error) {

                if (error.response && ('data' in error.response)) {
                    console.log(`Error: ${error.response.data.message}`);
                }

                console.log(error);
                break repos_loop;

            }
        }

        // Se migran los "issues", "labels", "comments" al repositorio de Github

        for (const key in issues) {
            if (!issues.hasOwnProperty(key)) return;

            const index = parseInt(key) + 1;
            const issue = issues[key];
            //console.log(issue);

            let createdIssue = null;
            let comments = [];

            try {

                comments = await gitlabApi.getIssueComments(project.id, issue.iid);
                //console.log(comments);

                console.log(`Processing issue "${issue.title}" (${index}/${issues.length}) and ${comments.length} comments`);

                createdIssue = await githubApi.createIssue({
                    "title": issue.title,
                    "body": githubApi.parseText(issue.description, issue.author.username),
                    //"assignee": issue.assignee && githubApi.getNamesakeUser(issue.assignee.username),
                    "assignees": issue.assignees && issue.assignees.map(assignee => githubApi.getNamesakeUser(assignee.username)),
                    ...((issue.milestone && issue.milestone.id in githubMilestonesList) ? {"milestone": githubMilestonesList[issue.milestone.id].number} : {}),
                    "labels": githubApi.parseLabels(issue.labels)
                });
                //console.log(createdIssue.data);

                if (!ArrayUtils.isEmpty(comments)) {
                    for (const key in comments) {
                        if (!comments.hasOwnProperty(key)) return;
    
                        let comment = comments[key];
                        //console.log(comment);
    
                        //const commentUserName = githubApi.getNamesakeUser(comment.author.username);
                        const createdComment = await githubApi.createComment(createdIssue.data.number, {
                            "body": githubApi.parseText(comment.body, comment.author.username)
                        });
                    }
                }
    
                if (issue.state === 'closed') {
                    const updatedIssue = await githubApi.updateIssue(createdIssue.data.number, {
                        "state": "closed"
                    });
                }
                
            } catch (error) {

                if (error.response && ('data' in error.response)) {
                    console.log(`Error: ${error.response.data.message}\n`);
                }

                console.log(error);
                break repos_loop;
                
            }
            
        }

        console.log(`Migration "${REPO.gitlab.project_name}" to Github successful!!!`)
        
    }
}