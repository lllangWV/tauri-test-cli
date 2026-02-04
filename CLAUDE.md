<!-- AGENTS-MD-EMBED-START:pixi -->
[Pixi Docs Index]|root: ./.agdex/pixi|IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any pixi tasks. Pixi is a cross-platform package manager for conda environments.|If docs missing, run: npx agdex --provider pixi --output CLAUDE.md|.:{first_workspace.md,getting_started.md,installation.md}|advanced:{channel_logic.md,explain_info_command.md,override.md,pixi_shell.md,shebang.md}|build:{advanced_cpp.md,backends.md,cpp.md,dependency_types.md,getting_started.md,package_source.md,python.md,ros.md,variants.md,workspace.md}|concepts:{conda_pypi.md}|deployment:{authentication.md,container.md,pixi_pack.md,s3.md}|global_tools:{introduction.md,manifest.md,trampolines.md}|integration/ci:{github_actions.md,updates_github_actions.md}|integration/editor:{jetbrains.md,jupyterlab.md,r_studio.md,vscode.md,zed.md}|integration/extensions:{introduction.md,pixi_diff.md,pixi_inject.md,pixi_install_to_prefix.md}|integration/third_party:{conda_deny.md,direnv.md,starship.md}|misc:{Community.md,FAQ.md,packaging.md,vision.md}|python:{pyproject_toml.md,pytorch.md,tutorial.md}|reference:{environment_variables.md,pixi_configuration.md,pixi_manifest.md}|reference/cli:{pixi.md}|reference/cli/pixi:{add.md,auth.md,build.md,clean.md,completion.md,config.md,exec.md,global.md,import.md,info.md,init.md,install.md,list.md,lock.md,reinstall.md,remove.md,run.md,search.md,self-update.md,shell-hook.md,shell.md,task.md,tree.md,update.md,upgrade.md,upload.md,workspace.md}|reference/cli/pixi/auth:{login.md,logout.md}|reference/cli/pixi/clean:{cache.md}|reference/cli/pixi/config:{append.md,edit.md,list.md,prepend.md,set.md,unset.md}|reference/cli/pixi/global:{add.md,edit.md,expose.md,install.md,list.md,remove.md,shortcut.md,sync.md,tree.md,uninstall.md,update.md,upgrade-all.md,upgrade.md}|reference/cli/pixi/global/expose:{add.md,remove.md}|reference/cli/pixi/global/shortcut:{add.md,remove.md}|reference/cli/pixi/task:{add.md,alias.md,list.md,remove.md}|reference/cli/pixi/upload:{anaconda.md,artifactory.md,conda-forge.md,prefix.md,quetz.md,s3.md}|reference/cli/pixi/workspace:{channel.md,description.md,environment.md,export.md,name.md,platform.md,requires-pixi.md,system-requirements.md,version.md}|reference/cli/pixi/workspace/channel:{add.md,list.md,remove.md}|reference/cli/pixi/workspace/description:{get.md,set.md}|reference/cli/pixi/workspace/environment:{add.md,list.md,remove.md}|reference/cli/pixi/workspace/export:{conda-environment.md,conda-explicit-spec.md}|reference/cli/pixi/workspace/name:{get.md,set.md}|reference/cli/pixi/workspace/platform:{add.md,list.md,remove.md}|reference/cli/pixi/workspace/requires-pixi:{get.md,set.md,unset.md,verify.md}|reference/cli/pixi/workspace/system-requirements:{add.md,list.md}|reference/cli/pixi/workspace/version:{get.md,major.md,minor.md,patch.md,set.md}|switching_from:{conda.md,poetry.md}|tutorials:{import.md,multi_environment.md,ros2.md,rust.md}|workspace:{advanced_tasks.md,environment.md,lockfile.md,multi_environment.md,multi_platform_configuration.md,system_requirements.md}
<!-- AGENTS-MD-EMBED-END:pixi -->


# CLAUDE.md

IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning 
for any pixi, tauri, bun, svelte, tasks.

## Required: Use pixi for all commands

**Never run directly:**
- `cargo build` / `cargo run` / `cargo test`
- `bun install` / `bun run`

**Always use:**
- `pixi run cargo build` / `pixi run cargo test`
- `pixi run bun install` / `pixi run bun run dev`

This ensures isolated environments without system package contamination.

## Testing the app

Open `assets/` folder to test with sample images.

## Before Writing Code

- Check existing patterns in codebase before creating new abstractions
- Read `.agdex/` docs when unsure about pixi/tauri/bun/svelte APIs
- Look at similar files for conventions (naming, structure, imports)

## Plan mode 

- Make the plan extremely concise, Sacrifice grammar for the sake of concisiion
- At the end of each plan, give me a list of unresolve questions to answer, if any

## Visual Testing

To verify tauri-drive cli work correctly, read `skills/tauri-driver-cli/visual_testing.md` for tauri-driver-cli usage.


## A Note To The Agent

We are building this together. WHen you learn something non-obvious, add it here so future changes go faster