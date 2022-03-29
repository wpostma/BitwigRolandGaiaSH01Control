// Generic Trace Controller Script by Warren Postma : warren.postma@gmail.com 
// (Don"t expect support by email.  You want to ask a question ask on the bitwig discord.)

loadAPI(14); // Bitwig 4.0.1+

println("Roland GAIA SH-01 :v2: Type trace=0 to turn trace output off,  trace=1 : tracing on,  trace=2 full tracing ");

// host.setShouldFailOnDeprecatedUse(true);

var trace = 2;

load ("Extensions.js");


host.defineController("Roland", "GAIA SH-01", "1.0", "ff37b2bc-23da-45c1-8eb0-5f83a30f3e53", "wpostma");

host.defineMidiPorts(1, 1);

host.addDeviceNameBasedDiscoveryPair(["SH-01"], ["SH-01"]);

var clip_mode= false;

var Mode = "Track";
var SubMode = "VolPan";
var tName = "None";
var tNameHasChanged = false;
var dName = "None";
var dNameHasChanged = false;
var pName = "None";
var presetHasChanged = false;
var pageNames = [];
var pageNumber = 0;
var pageHasChanged = false;

var activescene = 0; // insert location for clip record
var autoplayscene = -1; // when >=0, and we press stop, in bank 2, start playing the recently recorded clip.

// global:
var cc_volume_pedal 	= 7;

// cc constants (mostly placeholders)
var cc_modulation_source = 177;
var cc_mod_expression = 1;
var cc_mod_dbeam	  = 102; // not sure.
// program change stuff
var program = 1;
var bank = 1;

var CC_MSG =  176; // + midi channel.


// housekeeping and stats
var callcount  = 0;
var last_cc = 0;


function showPopupNotification(msg) {
 println("::> "+msg);

 host.showPopupNotification(msg);
}

function init()
{
	host.getMidiInPort(0).setMidiCallback(onMidi);
  host.getMidiInPort(0).setSysexCallback(onSysex);

	
	
	
   


   
   // Creating the main objects:
   application = host.createApplicationSection();
   groove = host.createGrooveSection();
   masterTrack = host.createMasterTrackSection(0);
   trackBank = host.createTrackBankSection(8, 4, 99); // this trackbank is probably the first 8 tracks but who the fuck knows with the vague ass documentation bitwig devs provide.
   transport = host.createTransportSection();
   
   keys = host.getMidiInPort(0).createNoteInput("SH-01 Keys", "8?????", "9?????", "B?01??", "B?02??", "B?07??", "B?0B??", "B?40??", "C?????", "D?????", "E?????", "F?????",  );
   keys.setShouldConsumeEvents(false); // true here would inhibit the keys from passing through.
   
   
   sceneBank = host.createSceneBank(8);


   //tracks = host.createTrackBank(8, 2, 0);
   //trackBank = host.createTrackBankSection(8, 1, 0);
   
   cursorTrack = host.createCursorTrack(3, 8);
   cursorDevice = cursorTrack.getPrimaryDevice();
   //cursorTrack.selectPrevious();
   //cursorTrack.selectNext();
   
   // to have knobs on your controller you must get the controls and sometimes you have to register interest in things in init

   uControl = host.createUserControls(6); // 0-5 : knobs. 
   for (var i = 0; i < 6; i++) {
      uControl.getControl(i).setLabel("Knob "+(i+1))
   }
      

   //setIndications("track");
   try {
   cursorTrack.clipLauncherSlotBank().addIsSelectedObserver	(	function(index,selected)
    {
        if (selected) {
          println(" user selected : " + index);
          activescene = index;
        }
    });
  } catch(e) {
    println("Unable to observe cursorTrack launcher selected ");
  }

  try {
    
    cursorDevice.presetName().addValueObserver( 50, "None", function(name){
    pName = name;
    if (presetHasChanged) {
       println( " ::preset::> "+name);
       presetHasChanged = false;
    }
 });
 } catch(e) {
  println( "Unable to observe preset name changes");
}


  

   

   try {
      // these can become deprecated over time.
      host.getNotificationSettings().setShouldShowSelectionNotifications (true);
      host.getNotificationSettings().setShouldShowChannelSelectionNotifications (true);
      host.getNotificationSettings().setShouldShowTrackSelectionNotifications (true);
      host.getNotificationSettings().setShouldShowDeviceSelectionNotifications (true);
      host.getNotificationSettings().setShouldShowDeviceLayerSelectionNotifications (true);
      host.getNotificationSettings().setShouldShowPresetNotifications (true);
      host.getNotificationSettings().setShouldShowMappingNotifications (true);
      host.getNotificationSettings().setShouldShowValueNotifications (true);
   } catch(e) {
	   println("host notification setup failure ")
   }

   host.scheduleTask(pollState, null, 500);
}

// This bit is definitely not generic.  If your device can be polled, see its sysex midi spec to find out how
function pollState() {
   //sendSysex("F0 00 20 6B 7F 42 01 00 00 2F F7");
}


// this little helper function is meant to make launching a clip or scene easy.
function playclipat(row, column) {
  if (row<0) {
    row = 0;
  }
  if (column<0) {
    column = 0;
  }
  if (clip_mode) {
    println("in clip mode launching scene " + column);
    trackBank.getChannel(row).getClipLauncherSlots().launch(column);
  } 
  else {
    // in scene mode the 1st row (top row in scene 1 on nano) controls scenes in Bitwig
    if (row == 0) {
        println("in scene mode and row 0, launching scene " + column);
        trackBank.launchScene(column);
    } else {
      trackBank.getChannel(row).getClipLauncherSlots().launch(column);
      println("channel launch "+row+"  " + column);
    }
}
}




var last_exec = {
	number: 0,
	bank: 0,
	vdata: 0
};

function do_function(number,bank,vdata)
{
  if (trace>0) {
    println("do_function "+number+" "+bank+" "+vdata);
  }

	// bank 1 
	if (bank == 1) {
		if ( (number == 1) &&  (vdata == 0) ){
			transport.play();
			showPopupNotification("play");
		}
		else if ( (number == 1) &&  (vdata != 0) ) {
			transport.stop();
			showPopupNotification("stop");		
		}
		else if  (number == 2) {
			transport.record();
			showPopupNotification("record");
		}
		else if  (number == 3)  {
			transport.toggleLoop();
			showPopupNotification("toggle loop");
		}	
		else if (number == 4)   {
			transport.rewind();
			showPopupNotification("rewind");
		}	
		else if (number == 5)    {
			transport.fastForward();
			showPopupNotification("fast forward");		 
		}
	}
	else if (bank == 2) {
		// bank 2 
    if ((number==1) &&(autoplayscene >=0) ) {
        //transport.stop(); // stops recording
        showPopupNotification("stop record");

        bank = cursorTrack.clipLauncherSlotBank();
        bank.select(autoplayscene);
        
        //sceneBank.launchScene(autoplayscene);
        // ransport.play();  // no worky.
        playclipat( 0, autoplayscene );

        //transport.play();
        
        showPopupNotification("loop playback "+autoplayscene);	
        autoplayscene = -1;
    }
    else
    if ( (number == 1) &&  (vdata == 0) ){
			transport.play();
			showPopupNotification("play");
		}
		else if ( (number == 1) &&  (vdata != 0) ) {
			transport.stop(); // stops recording
      
     
        showPopupNotification("stop");	
    }
		else if (number == 2) {
        // in bank 1 it"s the main record, in bank 2, let"s do a clip record.
        
        
        
        bank = cursorTrack.clipLauncherSlotBank();
        
        bank.select(activescene);
        //bank.record(activescene);
        //cursorTrack = host.createCursorTrack(3, 8);

        cursorTrack.recordNewLauncherClip (activescene);
        autoplayscene = activescene;

        activescene = activescene + 1;        
        if (activescene >= 8) {
          activescene = 0;
        }

        showPopupNotification("record clip "+activescene );
		}
		else if (number == 3) {
      transport.toggleClick();
      showPopupNotification("click track");
		}	
		else if (number == 4) {
			
      //transport.play();
      if (vdata == 0) {
        transport.continuePlayback();
        showPopupNotification("continue");
      } else {
        transport.stop();
        showPopupNotification("stop");
      }

      
		}	
		else if (number == 5)  {
      // This will play the first clip in the project if it exists.
      // If no clip exists we don't yet know what code to write to actually find out is there anything to launch
      // and then don't return true/false from the launch() method, like they should have.
      row=1;
      column=1;
      //trackBank.getChannel(row).getClipLauncherSlots().launch(column);
      trackBank.getChannel(row).getClipLauncherSlots().launch(column);

    }
			
	}
	else if (bank == 3 ) {
		// bank 3
		if (number == 1)  {
			trackBank.scrollTracksPageUp();
		}
		else if (number == 2)  {
			trackBank.scrollTracksPageDown();
		}
		else if (number == 3)  {
			cursorTrack.selectPrevious();
		}	
		else if (number == 4)  {
			cursorTrack.selectNext();	
		}	
		else if (number == 5)   {
			// todo
    }	
    

      //groove.getEnabled().set( vdata, 127);
      //showPopupNotification("groove");

      //transport.togglePunchIn();
      //showPopupNotification("punch in")
      
      //transport.togglePunchOut();
      //showPopupNotification("punch out")

		
	}
	
		

		 
	last_exec.number = number;
	last_exec.bank = bank;
	last_exec.vdata = vdata;
	
	
}

function onOff(dvalue) {
  if (dvalue==0) {
    return "OFF";
  }
  else {
    return "ON";
  }
}

function SendCC(cc,value) {
  if (value==undefined) 
    return;
  
  if (trace>0) {
  println("send Midi CC "+cc+" "+value);
  }
  if (value<0) {
    value = 0;
  }
  if (value>127) {
    value = 127;
  }
  keys.sendRawMidiEvent(CC_MSG, /*data1*/cc, /*data2*/value );
}

function pad(num, size) {
   num = num.toString();
   while (num.length < size) num = "0" + num;
   return num;
}
function onMidi(status, data1, data2) {

  callcount = callcount +1;

    // Instantiate the MidiData Object for convenience:
   var midi = new MidiData(status, data1, data2);
   var msgtype = "?";
   
 println("onmidi");
 
   if (trace>0) {

   
	  if (midi.isProgramChange()) {
		msgtype = "PC"; // 0xC0:
            
	  }
	  else if (midi.isChannelController()) {
         msgtype = "CC";
      } else if (midi.isNoteOn()) {
         msgtype = "NOTE ON "+midi.note();
      } else if (midi.isNoteOff()) {
         msgtype = "NOTE OFF "+midi.note();
      } else if (midi.isKeyPressure()){
         msgtype = "POLY AFTERTOUCH";
      } else if (midi.isPitchBend()) {
		  msgtype = "BEND";
	  }
   
     println("MIDI MESSAGE #"+pad(callcount,6)+" CHANNEL "+midi.channel()+" --> "+status+"("+msgtype+")  :  data1="+midi.data1+", data2="+midi.data2);
   }

    if (midi.isChannelController()) {
        if (midi.data1==cc_mod_expression) {
        
          // ignore
        }
         else if (midi.data1>=  cc_mod_dbeam) {
            // d-beam.
            var avalue = Math.floor( (midi.data2 -68) * 1.96 );
            if (avalue<2) {
               avalue = 63; // kinda weird, return to center.
            } else if (avalue>127) {
              avalue = 127;
            }
            println("d-beam "+ avalue);
            SendCC(33,avalue);
        }
          
	 }
   // }

}// end cc trace


function onSysex(data) {
   printSysex(data);
   println("sysex:"+data);
}



println("READY.")

function exit()
{
   // nothing to do here ;-)
}
