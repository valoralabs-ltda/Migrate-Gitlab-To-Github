const axios = require('axios');
const replaceAsync = require('string-replace-async');
const ArrayUtils = require('../utils/ArrayUtils.js');

module.exports = class GithubApi {

    constructor(ENV_CONFIG) {
        this.api = axios.create({
            baseURL: 'https://api.github.com',
            timeout: 60000,
            headers: {
                'Content-type': 'application/json; charset=utf-8',
                'Authorization': `token ${ENV_CONFIG.GITHUB_TOKEN}`
            }
        });
    }

    setGitlabProject(project)
    {
        this.gitlabProject = project;
    }

    setRepository(owner, repoName)
    {
        this.repository = `${owner}/${repoName}`;
    }

    setUsersNamesakes(githubUsers)
    {
        this.usersNamesakes = githubUsers;
    }

    createMilestone(data)
    {
        return this.api.post(`/repos/${this.repository}/milestones`, data);
    }

    createIssue(data)
    {
        return this.api.post(`/repos/${this.repository}/issues`, data);
    }

    updateIssue(issueNumber, data)
    {
        return this.api.patch(`/repos/${this.repository}/issues/${issueNumber}`, data);
    }

    createComment(issueNumber, data)
    {
        return this.api.post(`/repos/${this.repository}/issues/${issueNumber}/comments`, data);
    }

    async addCollaborator(username, data)
    {
        const res = await this.api.put(`/repos/${this.repository}/collaborators/${username}`, data);
        return res.data;
    }

    async createFile(path, data)
    {
        const res = await this.api.put(`/repos/${this.repository}/contents/${path}`, data);
        return res.data;
    }

    getNamesakeUser(gitlabUsername)
    {
        if (gitlabUsername in this.usersNamesakes) {
            return this.usersNamesakes[gitlabUsername];
        }
        return '';
    }

    parseText(text, gitlabUsername)
    {
        if (!text) {
            return text;
        }

        let parsedText = text.replace(/(?:\n)/g, '\n> ');
        parsedText = `Autor desde Gitlab: @${gitlabUsername}\n\n> ${parsedText}`;

        Object.keys(this.usersNamesakes).forEach(key => {
            parsedText = parsedText.replace(new RegExp(`${key}`, "g"), `${this.usersNamesakes[key]}`);
        });

        //parsedText = this.importAndReplaceFilesIfNeeded(parsedText);

        return parsedText;
    }

    parseLabels(labels)
    {
        if (ArrayUtils.isEmpty(labels)) {
            return labels;
        }

        const allowedLabels = {
            "Development": "enhancement",
            "Bug": "bug",
            //"QA": "QA",
            //"Passed": "Passed",
            //"Rework": "invalid",
            "Documentation": "documentation"
        };

        return labels.filter(function(label, index) {
            return (label in allowedLabels);
        }).map(function(label, index) {
            return (label in allowedLabels) ? allowedLabels[label] : label;
        });
    }

    importAndReplaceFilesIfNeeded(text)
    {
        // Ref:
        // https://gist.github.com/maxisam/5c6ec10cc4146adce05d62f553c5062f
        
        const gitlabUrlFormat = `${this.gitlabProject.web_url}[:file:]`;
        const urlRegex = /(\/uploads\/[^\s)]+)/g;

        return replaceAsync(text, urlRegex, async (url) => {
            try {
                const fileUrl = encodeURI(gitlabUrlFormat.replace('[:file:]', url));
                const filename = new Date().getTime() + parseInt(Math.random() * 1e6).toString();
                const fileExt = Utils.getUrlExtension(fileUrl);

                const destPath = `migration_files/${filename}.${fileExt}`;

                //console.log(fileUrl, destPath);

                const newFile = await axios.get(fileUrl, { responseType: 'arraybuffer' });
                const newFileBase64 = Buffer.from(newFile.data).toString('base64');

                const createdFile = await this.createFile(destPath, {
                    "message": "Archivo migrado desde Gitlab",
                    "content": newFileBase64 //Base64 encoding
                });

                //console.log(createdFile);
                return createdFile.content.html_url+'?raw=true';

            } catch (error) {

                //console.log(error);
                return url;

            }
        });
    }

}