const moment = require('moment');
const GitlabApi = require('./libs/GitlabApi.js');
const GithubApi = require('./libs/GithubApi.js');
const ArrayUtils = require('./utils/ArrayUtils.js');

module.exports = async function main(ENV_CONFIG)
{
    
    const gitlabApi = new GitlabApi(ENV_CONFIG);
    const githubApi = new GithubApi(ENV_CONFIG);

    for (const key in ENV_CONFIG.MIGRATE_REPOS) {
        if (!ENV_CONFIG.MIGRATE_REPOS.hasOwnProperty(key)) return;

        const REPO = ENV_CONFIG.MIGRATE_REPOS[key];

        try {

            /**
             * Get data from Gitlab
             */
            
            const project = await gitlabApi.getProjectData(REPO.gitlab.project_name, REPO.gitlab.group_id);
            const members = await gitlabApi.getMembers(project.id);
            const issues = await gitlabApi.getIssues(project.id);
            const milestones = await gitlabApi.getMilestones(project.id);
    
            /**
             * Process and send data to Github
             */

            githubApi.setGitlabProject(project);
            githubApi.setRepository(REPO.github.owner, REPO.github.repo_name);
            githubApi.setUsersNamesakes(REPO.namesake_users);
    
            const githubMilestonesList = {};

            // Se agregan los "collaborators" al repositorio de Github

            for (const key in members) {
                if (!members.hasOwnProperty(key)) return;
    
                const member = members[key];
                //console.log(member);
    
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
                }
            }

            // Se migran los "milestones" al repositorio de Github
    
            for (const key in milestones) {
                if (!milestones.hasOwnProperty(key)) return;
    
                const milestone = milestones[key];
                //console.log(milestone);
    
                const createdMilestone = await githubApi.createMilestone({
                    "title": milestone.title,
                    "state": milestone.state === 'active' ? 'open' : milestone.state,
                    ...(milestone.description ? {"description": milestone.description} : {}),
                    "due_on": milestone.due_date ? moment(milestone.due_date).format('YYYY-MM-DD[T]HH:mm:ss[Z]') : moment().format('YYYY-MM-DD[T]HH:mm:ss[Z]')
                });
    
                githubMilestonesList[milestone.id] = createdMilestone.data;
            }

            // Se migran los "issues", "labels", "comments" al repositorio de Github
    
            for (const key in issues) {
                if (!issues.hasOwnProperty(key)) return;
    
                const issue = issues[key];
                //console.log(issue);

                const comments = await gitlabApi.getIssueComments(project.id, issue.iid);
                //console.log(comments);
    
                const createdIssue = await githubApi.createIssue({
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
                
            }

            console.log(`Migration "${REPO.gitlab.project_name}" to Github successful!!!`)
    
        } catch (error) {

            console.log(`Migration "${REPO.gitlab.project_name}" to Github error!!!`)
            console.log(error)

            if (error.response && 'data' in error.response) {
                console.log(error.response.data);
            }

        }
    }
}