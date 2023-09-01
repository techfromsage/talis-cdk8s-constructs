# Updating k8s imports

In order to update Kubernetes imports to the specific cluster version, run the following command:

```sh
nvm use
npx cdk8s import -l typescript k8s@1.27.0
```

# Updating KEDA imports

Some autoscaling is based on KEDA. In order to update KEDA imports to the specific version, run the following command:

```sh
# Download the KEDA YAML, note the version number, and extract the CRDs
curl -L https://github.com/kedacore/keda/releases/download/v2.9.3/keda-2.9.3.yaml > imports/keda.yaml

# Update the imports
nvm use
npx cdk8s import -l typescript imports/keda.yaml

# Remove CRDs YAML
rm imports/keda.yaml
```
