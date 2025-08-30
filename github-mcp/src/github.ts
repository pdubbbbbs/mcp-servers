import {
  GitHubRepository,
  GitHubIssue,
  GitHubPullRequest,
  ListRepositoriesRequest,
  CreateRepositoryRequest,
  ListIssuesRequest,
  CreateIssueRequest,
  CreatePullRequestRequest,
} from './types';

export class GitHubClient {
  private token: string;
  private baseUrl = 'https://api.github.com';

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-MCP-Server/1.0.0',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error (${response.status}): ${error}`);
    }

    return response.json();
  }

  // Repository operations
  async listRepositories(params: ListRepositoriesRequest = {}): Promise<GitHubRepository[]> {
    const searchParams = new URLSearchParams();
    
    if (params.type) searchParams.append('type', params.type);
    if (params.sort) searchParams.append('sort', params.sort);
    if (params.direction) searchParams.append('direction', params.direction);
    if (params.per_page) searchParams.append('per_page', params.per_page.toString());
    if (params.page) searchParams.append('page', params.page.toString());

    const endpoint = params.owner 
      ? `/users/${params.owner}/repos?${searchParams}`
      : `/user/repos?${searchParams}`;

    return this.request<GitHubRepository[]>(endpoint);
  }

  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    return this.request<GitHubRepository>(`/repos/${owner}/${repo}`);
  }

  async createRepository(params: CreateRepositoryRequest): Promise<GitHubRepository> {
    return this.request<GitHubRepository>('/user/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  }

  async deleteRepository(owner: string, repo: string): Promise<void> {
    await this.request(`/repos/${owner}/${repo}`, {
      method: 'DELETE',
    });
  }

  // Issue operations
  async listIssues(params: ListIssuesRequest): Promise<GitHubIssue[]> {
    const { owner, repo, ...queryParams } = params;
    const searchParams = new URLSearchParams();

    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });

    return this.request<GitHubIssue[]>(`/repos/${owner}/${repo}/issues?${searchParams}`);
  }

  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    return this.request<GitHubIssue>(`/repos/${owner}/${repo}/issues/${issueNumber}`);
  }

  async createIssue(params: CreateIssueRequest): Promise<GitHubIssue> {
    const { owner, repo, ...body } = params;
    return this.request<GitHubIssue>(`/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async updateIssue(
    owner: string, 
    repo: string, 
    issueNumber: number, 
    updates: Partial<CreateIssueRequest>
  ): Promise<GitHubIssue> {
    return this.request<GitHubIssue>(`/repos/${owner}/${repo}/issues/${issueNumber}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  }

  async closeIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    return this.updateIssue(owner, repo, issueNumber, { state: 'closed' as any });
  }

  // Pull Request operations
  async listPullRequests(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GitHubPullRequest[]> {
    return this.request<GitHubPullRequest[]>(`/repos/${owner}/${repo}/pulls?state=${state}`);
  }

  async getPullRequest(owner: string, repo: string, pullNumber: number): Promise<GitHubPullRequest> {
    return this.request<GitHubPullRequest>(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
  }

  async createPullRequest(params: CreatePullRequestRequest): Promise<GitHubPullRequest> {
    const { owner, repo, ...body } = params;
    return this.request<GitHubPullRequest>(`/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async mergePullRequest(
    owner: string, 
    repo: string, 
    pullNumber: number,
    commitTitle?: string,
    commitMessage?: string,
    mergeMethod: 'merge' | 'squash' | 'rebase' = 'merge'
  ): Promise<{ sha: string; merged: boolean; message: string }> {
    const body: any = { merge_method: mergeMethod };
    if (commitTitle) body.commit_title = commitTitle;
    if (commitMessage) body.commit_message = commitMessage;

    return this.request(`/repos/${owner}/${repo}/pulls/${pullNumber}/merge`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  // Search operations
  async searchRepositories(query: string, sort?: string, order?: 'asc' | 'desc'): Promise<GitHubRepository[]> {
    const searchParams = new URLSearchParams({ q: query });
    if (sort) searchParams.append('sort', sort);
    if (order) searchParams.append('order', order);

    const result = await this.request<{ items: GitHubRepository[] }>(`/search/repositories?${searchParams}`);
    return result.items;
  }

  async searchIssues(query: string, sort?: string, order?: 'asc' | 'desc'): Promise<GitHubIssue[]> {
    const searchParams = new URLSearchParams({ q: query });
    if (sort) searchParams.append('sort', sort);
    if (order) searchParams.append('order', order);

    const result = await this.request<{ items: GitHubIssue[] }>(`/search/issues?${searchParams}`);
    return result.items;
  }

  // User operations
  async getAuthenticatedUser() {
    return this.request('/user');
  }

  async getUser(username: string) {
    return this.request(`/users/${username}`);
  }
}
