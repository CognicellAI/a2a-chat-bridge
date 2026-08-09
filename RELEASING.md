# Releasing

Use this checklist for each public release.

1. Confirm the version in `package.json` and add a dated `CHANGELOG.md` entry.
2. Run the local checks in [CONTRIBUTING.md](CONTRIBUTING.md).
3. Verify `config.yaml`, `.env`, `data/`, `dist/`, and `*.bun-build` are absent
   from the commit.
4. Review `config.example.yaml`, the user guides, and `README.md` for accuracy.
5. Create an annotated Git tag: `git tag -a vX.Y.Z -m "vX.Y.Z"`.
6. Push the tag and create a GitHub release with the matching changelog notes.

This repository releases source and a Docker image. It does not publish an npm
package while `package.json` remains `private`.
