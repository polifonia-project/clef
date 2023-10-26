VAGRANTFILE_API_VERSION = "2"

$bootstrap = <<SCRIPT
apt-get update
apt-get install -y bzip2
apt-get install -y python-pip python-dev python3-pip
apt-get install -y curl
apt-get install -y xvfb
apt-get -y install openjdk-11-jdk

apt install -y python3.7
update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.6 1
update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.7 2
python3.7 -m pip install pip
SCRIPT

$install = <<SCRIPT
BLAZEGRAPH_PATH="/var/lib/blazegraph.jar"
SPARQLANYTHING_PATH="/var/lib/sparql-anything-server-0.8.2.jar"

if [ ! -f "$BLAZEGRAPH_PATH" ]; then
	curl -L "https://github.com/blazegraph/database/releases/download/BLAZEGRAPH_2_1_6_RC/blazegraph.jar" --output $BLAZEGRAPH_PATH
fi

if [ ! -f "$SPARQLANYTHING_PATH" ]; then
	curl -L "https://github.com/SPARQL-Anything/sparql.anything/releases/download/v0.8.2/sparql-anything-server-0.8.2.jar" --output $SPARQLANYTHING_PATH
fi

SCRIPT

$web_install = <<SCRIPT
APP_DIR="/app"

echo -n "Installing webapp..."
python3.7 -m pip install --upgrade pip
python3.7 -m pip install -r $APP_DIR/requirements.txt

SCRIPT

$web_run = <<SCRIPT

BLAZEGRAPH_PATH="/var/lib/blazegraph.jar"
BLAZEGRAPH_PORT=3000
BLAZEGRAPH_PROPERTY_FILE="/app/blaze_vm.properties"
SPARQLANYTHING_PATH="/var/lib/sparql-anything-server-0.8.2.jar"
SPARQLANYTHING_PORT=8081
APP_DIR="/app"
WEBAPP_PORT=8080

echo -n "Running Blazegraph..."
lsof -ti tcp:${BLAZEGRAPH_PORT} | xargs --no-run-if-empty kill
java -Dfile.encoding=UTF-8 -Dsun.jnu.encoding=UTF-8 -server -Xmx2g -Djetty.port=${BLAZEGRAPH_PORT} -Dbigdata.propertyFile=$BLAZEGRAPH_PROPERTY_FILE -Djetty.start.timeout=60 -jar $BLAZEGRAPH_PATH &
sleep 10


echo -n "Running SPARQL-Anything..."
java -jar $SPARQLANYTHING_PATH --port=$SPARQLANYTHING_PORT &
sleep 5

cd $APP_DIR

echo -n "Running webapp..."
python3 app.py $WEBAPP_PORT &
echo -n "Webapp should be running..."
sleep 5
SCRIPT

Vagrant.configure(VAGRANTFILE_API_VERSION) do |config|
  # Every Vagrant virtual environment requires a box to build off of.
  config.vm.box = "hashicorp/bionic64"
  config.vm.synced_folder "./", "/app", create: true
  config.vm.synced_folder "./data/", "/data", create: true

  config.vm.network "forwarded_port", guest: 8080, host: 8080
  config.vm.network "forwarded_port", guest: 8081, host: 8081
  config.vm.network "forwarded_port", guest: 3000, host: 3000
 
  config.vm.provider "virtualbox" do |v|
    v.memory = 4096
  end
  
  config.vm.provision "shell", inline: $bootstrap
  config.vm.provision "shell", run: "always", inline: $install, privileged: true
  config.vm.provision "shell", run: "always", inline: $web_install, privileged: false
  config.vm.provision "shell", run: "always", inline: $web_run, privileged: false
end