workflow "CI & publish" {
  on = "push"
  resolves = ["publish-npm"]
}

action "install" {
  uses = "actions/npm@master"
  args = "install"
}

action "test" {
  needs = "install"
  uses = "actions/npm@master"
  args = "test"
}

# Filter for a new tag
action "on-tag" {
  needs = "test"
  uses = "actions/bin/filter@master"
  args = "tag"
}

action "publish-gpr" {
  needs = "on-tag"
  uses = "actions/npm@master"
  args = "publish --access public"
  env = {
    NPM_REGISTRY_URL = "npm.pkg.github.com"
  }
  secrets = ["GITHUB_TOKEN"]
}

action "publish-npm" {
  needs = "publish-gpr"
  uses = "actions/npm@master"
  args = "publish --access public"
  secrets = ["NPM_AUTH_TOKEN"]
}
