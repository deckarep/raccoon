// Raccoon code editor

function rcn_code_ed() {
  this.window = new rcn_window('code_ed', 'Code Editor');
  this.textarea = document.createElement('textarea');
  this.window.add_child(this.textarea);

  this.run_button = document.createElement('input');
  this.run_button.type = 'button';
  this.run_button.value = 'Run';
  this.window.add_child(this.run_button);

  var code_ed = this;
  this.run_button.onclick = function() {
    rcn_global_vm.load_code(code_ed.textarea.value);
  }
}
