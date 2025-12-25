

class SamplePlugin {
  constructor() {
    this.name = "SamplePlugin";
    this.api = null;

    
  }

  activate(api) {
    this.api = api;
    this.api.log("SamplePlugin activated");

  }


  deactivate() {
    this.api.log("SamplePlugin deactivated");
  }
}

module.exports = SamplePlugin;
