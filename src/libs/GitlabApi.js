const axios = require('axios');
const ArrayUtils = require('../utils/ArrayUtils.js');

module.exports = class GitlabApi {

    constructor(ENV_CONFIG) {
        this.api = axios.create({
            baseURL: 'https://gitlab.com/api/v4',
            timeout: 60000,
            headers: {
                'Content-type': 'application/json; charset=utf-8',
                'PRIVATE-TOKEN': ENV_CONFIG.GITLAB_TOKEN
            }
        });
    }

    async getProjectData(projectName, groupId = null)
    {
        let projects;
        if (groupId) {
            projects = await this.api.get(`/groups/${groupId}/projects?search=${projectName}`);
        } else {
            projects = await this.api.get(`projects?search=${projectName}`);
        }
        if (ArrayUtils.isEmpty(projects.data)) {
            throw Error('Error al devolver la información del proyecto');
        }
        return projects.data[0];
    }

    async getMembers(projectId)
    {
        const members = await this.api.get(`/projects/${projectId}/members/all`);
        return members.data;
    }

    async getIssues(projectId, pageNumber = null, previousIssues = [])
    {
        const page = pageNumber ? `&page=${pageNumber}` : '';
        const issues = await this.api.get(`/projects/${projectId}/issues?sort=asc&order_by=created_at&per_page=100${page}`);

        if (issues.headers['x-next-page']) {
            const remainingIssues = await this.getIssues(projectId, issues.headers['x-next-page'], issues.data);
            return previousIssues.concat(remainingIssues);
        } else {
            return previousIssues.concat(issues.data);
        }
    }

    async getIssueComments(projectId, issueIid, pageNumber = null, previousComments = [])
    {
        const page = pageNumber ? `&page=${pageNumber}` : '';
        const notes = await this.api.get(`/projects/${projectId}/issues/${issueIid}/notes?sort=asc&order_by=created_at&per_page=100${page}`);

        if (notes.headers['x-next-page']) {
            const remainingComments = await this.getIssueComments(projectId, issueIid, notes.headers['x-next-page'], notes.data);
            return previousComments.concat(remainingComments);
        } else {
            return previousComments.concat(notes.data);
        }
    }

    async getMilestones(projectId, pageNumber = null, previousMilestones = [])
    {
        const page = pageNumber ? `&page=${pageNumber}` : '';
        const milestones = await this.api.get(`/projects/${projectId}/milestones?per_page=100${page}`);

        if (milestones.headers['x-next-page']) {
            const remainingMilestones = await this.getMilestones(projectId, milestones.headers['x-next-page'], milestones.data);
            return previousMilestones.concat(remainingMilestones);
        } else {
            return previousMilestones.concat(milestones.data);
        }
    }

}