// Raccoon sprite editor

function rcn_sprite_ed() {
  this.__proto__.__proto__ = rcn_window.prototype;
  rcn_window.call(this);

  // Init sprite editing state
  this.current_color = 0;
  this.current_sprite = 0;
  this.current_sprite_width = 8;
  this.current_sprite_height = 8;
  this.current_sprite_page = 0;

  var sprite_ed = this;

  // Create panel
  this.panel_div = document.createElement('div');
  this.panel_div.classList.add('panel');
  this.add_child(this.panel_div);

  // Create sprite index text
  this.sprite_index_text = document.createElement('div');
  this.sprite_index_text.classList.add('sprite_index');
  this.panel_div.appendChild(this.sprite_index_text);

  // Create color inputs
  this.color_inputs = [];
  this.color_radios = [];
  for(var i=0; i<8; i++) {
    var color_wrapper = document.createElement('div');
    var color_radio = document.createElement('input');
    color_radio.type = 'radio';
    color_radio.name = 'sprite_ed_color_radio';
    color_radio.color_index = i;
    color_radio.checked = (this.current_color == i);
    color_radio.onchange = function() {
      sprite_ed.current_color = this.color_index;
    }
    this.color_radios.push(color_radio);
    color_wrapper.appendChild(color_radio);

    var color_input_id = 'color_input_'+i;
    var color_label = document.createElement('label');
    color_label.innerText = i;
    color_label.htmlFor = color_input_id;
    color_wrapper.appendChild(color_label);

    var color_input = document.createElement('input');
    color_input.type = 'color';
    color_input.id = color_input_id;
    color_input.onchange = function() {
      // Update bin's palette with UI palette
      rcn_global_bin.patch_memory(sprite_ed.get_palette_bytes(), rcn.mem_palette_offset);
      rcn_dispatch_ed_event('rcnbinchange', {
        begin: rcn.mem_palette_offset,
        end: rcn.mem_palette_offset+rcn.mem_palette_size,
      });
    }
    this.color_inputs.push(color_input);
    color_wrapper.appendChild(color_input);

    this.panel_div.appendChild(color_wrapper);
  }

  // Create draw canvas
  this.draw_canvas = new rcn_canvas();
  this.draw_canvas.node.classList.add('draw');
  var draw_mouse_callback = function(e) {
    if(e.buttons > 0) {
      var canvas_coords = this.getBoundingClientRect();
      var tex_coords = sprite_ed.draw_canvas.client_to_texture_coords(e.clientX - canvas_coords.x, e.clientY - canvas_coords.y);
      if(tex_coords) {
        if(e.buttons == 1) { // Left button: draw
          sprite_ed.set_pixel(tex_coords.x, tex_coords.y);
        } else if(e.buttons == 2) { // Right button: color pick
          sprite_ed.set_current_color(sprite_ed.get_pixel(tex_coords.x, tex_coords.y))
        }
      }
    }
  }
  this.draw_canvas.node.addEventListener('contextmenu', function(e){e.preventDefault()});
  this.draw_canvas.node.addEventListener('mousedown', draw_mouse_callback);
  this.draw_canvas.node.addEventListener('mousemove', draw_mouse_callback);
  this.add_child(this.draw_canvas.node);

  // Create spritesheet canvas
  this.spritesheet_canvas = new rcn_canvas();
  this.spritesheet_canvas.node.classList.add('spritesheet');
  var sheet_mouse_callback = function(e) {
    if(e.buttons === 1) { // Left button: select sprite
      var canvas_coords = this.getBoundingClientRect();
      var tex_coords = sprite_ed.spritesheet_canvas.client_to_texture_coords(e.clientX - canvas_coords.x, e.clientY - canvas_coords.y);
      if(tex_coords) {
        sprite_ed.current_sprite = (sprite_ed.current_sprite_page << 6) + (tex_coords.x >> 3) + ((tex_coords.y >> 3) << 4);
        sprite_ed.update_sprite_index_text();
        sprite_ed.update_draw_canvas();
        sprite_ed.update_spritesheet_canvas();
      }
    }
  }
  this.spritesheet_canvas.node.addEventListener('mousedown', sheet_mouse_callback);
  this.spritesheet_canvas.node.addEventListener('mousemove', sheet_mouse_callback);
  this.spritesheet_canvas.onpostflush = function() {
    var vp = this.compute_viewport();
    var cur_spr = sprite_ed.current_sprite;
    if((cur_spr >> 6) == sprite_ed.current_sprite_page) {
      cur_spr = cur_spr & 0x3f;
      var spr_x = cur_spr & 0xf;
      var spr_y = cur_spr >> 4;
      var x = vp.x + spr_x*vp.mul*8;
      var y = vp.y + spr_y*vp.mul*8;
      var width = sprite_ed.current_sprite_width * vp.mul;
      var height = sprite_ed.current_sprite_height * vp.mul;
      this.draw_quad(x, y, width, height, 1, 1, 1, 0.5);
    }
  }
  this.add_child(this.spritesheet_canvas.node);

  // Create sprite page range
  this.sprite_page_range = document.createElement('input');
  this.sprite_page_range.type = 'range';
  this.sprite_page_range.value = 0
  this.sprite_page_range.min = 0;
  this.sprite_page_range.max = 3;
  this.sprite_page_range.step = 1;
  this.sprite_page_range.oninput = function(e) {
    sprite_ed.current_sprite_page = this.value;
    sprite_ed.update_spritesheet_canvas();
  };
  this.add_child(this.sprite_page_range);

  // Create sprite size range
  this.sprite_size_range = document.createElement('input');
  this.sprite_size_range.type = 'range';
  this.sprite_size_range.value = 8;
  this.sprite_size_range.min = 8;
  this.sprite_size_range.max = 32;
  this.sprite_size_range.step = 8;
  this.sprite_size_range.oninput = function(e) {
    sprite_ed.current_sprite_width = sprite_ed.current_sprite_height = this.value;
    sprite_ed.update_draw_canvas();
    sprite_ed.update_spritesheet_canvas();
  };
  this.add_child(this.sprite_size_range);

  // Create apply button
  this.apply_button = document.createElement('input');
  this.apply_button.type = 'button';
  this.apply_button.value = 'Apply';
  this.add_child(this.apply_button);

  this.apply_button.onclick = function() {
    // Update VM spritesheet with bin spritesheet
    rcn_dispatch_ed_event('rcnbinapply', {offset: rcn.mem_spritesheet_offset, size: rcn.mem_spritesheet_size});
    // Update VM palette with bin palette
    rcn_dispatch_ed_event('rcnbinapply', {offset: rcn.mem_palette_offset, size: rcn.mem_palette_size});
  }

  this.addEventListener('rcnbinchange', function(e) {
    // Palette update
    const mem_palette_begin = rcn.mem_palette_offset;
    const mem_palette_end = rcn.mem_palette_offset + rcn.mem_palette_size;
    if(e.detail.begin < mem_palette_end && e.detail.end > mem_palette_begin) {
      sprite_ed.update_color_inputs();
      sprite_ed.update_draw_canvas();
      sprite_ed.update_spritesheet_canvas();
    }

    // Spritesheet update
    const mem_spritesheet_begin = rcn.mem_spritesheet_offset;
    const mem_spritesheet_end = rcn.mem_spritesheet_offset + rcn.mem_spritesheet_size;
    if(e.detail.begin < mem_spritesheet_end && e.detail.end > mem_spritesheet_begin) {
      sprite_ed.update_draw_canvas();
      sprite_ed.update_spritesheet_canvas();
    }
  });

  this.update_sprite_index_text();
  this.update_color_inputs();
  this.update_draw_canvas();
  this.update_spritesheet_canvas();
}

rcn_sprite_ed.prototype.title = 'Sprite Editor';
rcn_sprite_ed.prototype.docs_link = 'sprite-editor';
rcn_sprite_ed.prototype.type = 'sprite_ed';

rcn_sprite_ed.prototype.update_color_inputs = function() {
  var palette_bytes = rcn_global_bin.rom.slice(rcn.mem_palette_offset, rcn.mem_palette_offset + rcn.mem_palette_size);
  for(var i=0; i<8; i++) {
    var rgb_str = '#';
    for(var j=0; j<3; j++) {
      rgb_str += ('00'+palette_bytes[i*3+j].toString(16)).slice(-2);
    }
    this.color_inputs[i].value = rgb_str;
  }
}

rcn_sprite_ed.prototype.get_palette_bytes = function() {
  var palette_bytes = new Uint8Array(rcn.mem_palette_size); // 8 RGB values
  for(var i=0; i<8; i++) {
    var rgb_int = parseInt(this.color_inputs[i].value.slice(1), 16);
    palette_bytes[i*3+0] = (rgb_int>>16);
    palette_bytes[i*3+1] = (rgb_int>>8) & 0xff;
    palette_bytes[i*3+2] = rgb_int & 0xff;
  }
  return palette_bytes;
}

rcn_sprite_ed.prototype.get_texel_index = function(draw_x, draw_y) {
  var spritesheet_offset_x = (this.current_sprite & 0xf) << 3;
  var spritesheet_offset_y = (this.current_sprite >> 4) << 3;
  var x = draw_x + spritesheet_offset_x;
  var y = draw_y + spritesheet_offset_y;
  return rcn.mem_spritesheet_offset+(y<<6)+(x>>1);
}

rcn_sprite_ed.prototype.set_pixel = function(draw_x, draw_y) {
  var texel_index = this.get_texel_index(draw_x, draw_y);
  var texel = rcn_global_bin.rom[texel_index];
  if((draw_x % 2) < 1) {
    texel &= 0xf0;
    texel |= this.current_color;
  } else {
    texel &= 0xf;
    texel |= this.current_color << 4;
  }
  rcn_global_bin.rom[texel_index] = texel;

  rcn_dispatch_ed_event('rcnbinchange', {
    begin: texel_index,
    end: texel_index+1,
  });
}

rcn_sprite_ed.prototype.get_pixel = function(draw_x, draw_y) {
  var texel_index = this.get_texel_index(draw_x, draw_y);
  var texel = rcn_global_bin.rom[texel_index];
  if((draw_x % 2) < 1) {
    return texel & 0xf;
  } else {
    return texel >> 4;
  }
}

rcn_sprite_ed.prototype.set_current_color = function(color) {
  this.current_color = color;
  this.color_radios[color].checked = true;
}

rcn_sprite_ed.prototype.update_sprite_index_text = function() {
  this.sprite_index_text.innerText = this.current_sprite.toString().padStart(3, '0');
}

rcn_sprite_ed.prototype.update_draw_canvas = function() {
  var spr_w = this.current_sprite_width;
  var spr_h = this.current_sprite_height;
  var pixels = new Uint8Array((spr_w * spr_h) >> 1);
  var texel_index = ((this.current_sprite & 0xf) << 2) + ((this.current_sprite >> 4) << 9);
  var row_size = spr_w >> 1;

  for(var i=0; i < spr_h; i++) {
    var row_index = texel_index + (i << 6);
    pixels.set(rcn_global_bin.rom.slice(row_index, row_index + row_size), i * row_size);
  }

  this.draw_canvas.set_aspect_ratio(1, 1);
  this.draw_canvas.set_size(spr_w, spr_h);
  this.draw_canvas.blit(0, 0, spr_w, spr_h, pixels);
  this.draw_canvas.flush();
}

rcn_sprite_ed.prototype.update_spritesheet_canvas = function() {
  var page_index = this.current_sprite_page << 11;
  this.spritesheet_canvas.set_aspect_ratio(4, 1);
  this.spritesheet_canvas.set_size(128, 32);
  this.spritesheet_canvas.blit(0, 0, 128, 32, rcn_global_bin.rom.slice(page_index));
  this.spritesheet_canvas.flush();
}

rcn_editors.push(rcn_sprite_ed);
