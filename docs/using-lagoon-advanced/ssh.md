# SSH

Lagoon allows you to connect to your running containers via SSH. The containers themselves don't actually have an SSH server installed, but instead you connect via SSH to Lagoon, which then itself creates a remote shell connection via the Kubernetes API for you.

## Ensure you are set up for SSH access

### Generating an SSH Key

It is recommended to generate a separate SSH key for each device as opposed to sharing the same key between multiple computers. Instructions for generating an SSH key on various systems can be found below:

**OSX (Mac)**

[Mac](https://www.makeuseof.com/ssh-keygen-mac){ .md-button }

#### Linux (Ubuntu)

[Linux](https://help.ubuntu.com/community/SSH/OpenSSH/Keys){ .md-button }

#### Windows

[Windows](https://docs.microsoft.com/en-us/windows-server/administration/openssh/openssh_keymanagement){ .md-button }

### SSH Agent

#### OSX (Mac)

OSX does not have its SSH agent configured to load configured SSH keys at startup, which can cause some headaches. You can find a handy guide to configuring this capability here: [https://www.backarapper.com/add-ssh-keys-to-ssh-agent-on-startup-in-macos/](https://www.backarapper.com/add-ssh-keys-to-ssh-agent-on-startup-in-macos/)

#### Linux

Linux distributions vary in how they use the `ssh-agent` . You can find a general guide here: [https://www.ssh.com/academy/ssh/agent](https://www.ssh.com/academy/ssh/agent)

#### **Windows**

SSH key support in Windows has improved markedly as of recently, and is now supported natively. A handy guide to configuring the Windows 10 SSH agent can be found here: [https://richardballard.co.uk/ssh-keys-on-windows-10/](https://richardballard.co.uk/ssh-keys-on-windows-10/)

### Uploading SSH Keys

### Via the UI

You can upload your SSH key(s) through the UI. Login as you normally would.&#x20;

In the upper right hand corner, click on Settings:

![Click "Settings" in the upper right hand corner](./drupal-example project 2021-11-18 19-03-22.png)

You will then see a page where you can upload your SSH key(s), and it will show any uploaded keys. Paste your key into the text box, give it a name, and click "Add." That's it! Add additional keys as needed.

![Paste your key into the text box.](./settings 2021-11-18 19-03-48.png)

### Via Command Line

A general example of using the Lagoon API via GraphQL to add an SSH key to a user can be found [here](../administering-lagoon/graphql-queries.md#allowing-access-to-the-project)

## SSH into a pod

### Connection

Connecting is straightforward and follows the following pattern:

```bash
ssh -p [PORT] -t [PROJECT-ENVIRONMENT-NAME]@[HOST]
```

* `PORT` - The remote shell SSH endpoint port (for amazee.io: `32222`).
* `HOST` - The remote shell SSH endpoint host (for amazee.io `ssh.lagoon.amazeeio.cloud`).
* `PROJECT-ENVIRONMENT-NAME` - The environment you want to connect to. This is most commonly in the pattern `PROJECTNAME-ENVIRONMENT`.

As an example:

```bash
ssh -p 32222 -t drupal-example-main@ssh.lagoon.amazeeio.cloud
```

This will connect you to the project `drupal-example` on the environment `main`.

### Pod/Service, Container Definition

By default, the remote shell will try to connect you to the container defined with the type `cli`. If you would like to connect to another pod/service you can define it via:

```bash
ssh -p [PORT] -t [PROJECT-ENVIRONMENT-NAME]@[HOST] service=[SERVICE-NAME]
```

If your pod/service contains multiple containers, Lagoon will connect you to the first defined container. You can also define the specific container to connect to via:

```bash
ssh -p [PORT] -t [PROJECT-ENVIRONMENT-NAME]@[HOST] service=[SERVICE-NAME] container=[CONTAINER-NAME]
```

For example, to connect to the `php` container within the `nginx` pod:

```bash
ssh -p 32222 -t drupal-example-main@ssh.lagoon.amazeeio.cloud service=nginx container=php
```