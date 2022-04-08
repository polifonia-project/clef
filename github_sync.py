import os , json
import requests
from github import Github, InputGitAuthor
import conf
import utils as u

dir_path = os.path.dirname(os.path.realpath(__file__))

# OAUTH APP


clientId = conf.gitClientID
clientSecret = conf.gitClientSecret

def is_git_auth():
	""" Return True if the app requires github auth"""

	u.reload_config()
	return True if conf.gitClientID != "" else False

def ask_user_permission(code):
	""" get user permission when authenticating via github"""
	res = None
	body = {
		"client_id" : clientId,
		"client_secret" : clientSecret,
		"code" : code
	}

	req = requests.post('https://github.com/login/oauth/access_token', data=body,
						headers={"accept": "application/json"})
	if req.status_code == 200:
		res = req.json()
	return res


def get_user_login(res):
	""" get github user information """
	userlogin, usermail = None, None
	print("user requesting github login:", res)
	access_token = res["access_token"]
	req_user = requests.get("https://api.github.com/user",
							headers={"Authorization": "token "+access_token})

	if req_user.status_code == 200:
		res_user = req_user.json()
		userlogin = res_user["login"]
		usermail = res_user["email"]
	return userlogin, usermail, access_token


def get_github_users(userlogin):
	""" match user with collaborators of github repository"""
	is_valid_user = False
	if conf.token != '' and conf.owner != '' and conf.repo_name != '':
		req = requests.get("https://api.github.com/repos/"+conf.owner+"/"+conf.repo_name+"/collaborators",
							headers={"Authorization": "token "+conf.token})
		if req.status_code == 200:
			users = [user['login'] for user in req.json()]
			if userlogin in users:
				is_valid_user = True
	return is_valid_user


def push(local_file_path, branch='main', gituser=None, email=None, bearer_token=None, action=''):
	""" create a new file or update an existing file.
	the remote file has the same relative path of the local one"""
	token = conf.token if bearer_token is None else bearer_token
	user = conf.author if gituser is None else gituser
	usermail = conf.author_email if email is None else email
	owner = conf.owner
	repo_name = conf.repo_name
	g = Github(token)
	repo = g.get_repo(owner+"/"+repo_name)
	author = InputGitAuthor(user,usermail) # commit author

	try:
		contents = repo.get_contents(local_file_path) # Retrieve the online file to get its SHA and path
		update=True
		message = "updated file "+local_file_path+' '+action
	except:
		update=False
		message = "created file "+local_file_path

	with open(local_file_path) as f: # Both create/update file replace the file with the local one
		data = f.read() # could be done in a smarter way

	if update == True:  # If file already exists, update it
		repo.update_file(contents.path, message, data, contents.sha, author=author)  # Add, commit and push branch
	else:
		try:
			# If file doesn't exist, create it in the same relative path of the local file
			repo.create_file(local_file_path, message, data, branch=branch, author=author)  # Add, commit and push branch
		except Exception as e:
			print(e)

def delete_file(local_file_path, branch, gituser=None, email=None, bearer_token=None):
	""" delete files form github """
	token = conf.token if bearer_token is None else bearer_token
	user = conf.author if gituser is None else gituser
	usermail = conf.author_email if email is None else email
	owner = conf.owner
	repo_name = conf.repo_name
	g = Github(token)
	repo = g.get_repo(owner+"/"+repo_name)
	author = InputGitAuthor(user,usermail) # commit author
	contents = repo.get_contents(local_file_path)
	message = "deleted file "+local_file_path
	repo.delete_file(contents.path, message, contents.sha, branch=branch)
