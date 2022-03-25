// Generic Trace Controller Script by Warren Postma : warren.postma@gmail.com 
// (Don"t expect support by email.  You want to ask a question ask on the bitwig discord.)

loadAPI(14); // Bitwig 4.0.1+

println("GenricTrace. Type trace=0 to turn trace output off,  trace=1 : tracing on,  trace=2 full tracing ");

// host.setShouldFailOnDeprecatedUse(true);

var trace = 2;

load ("Extensions.js");


host.defineController("GenericTrace", "GenericTrace", "1.0", "c937b2bc-23da-45c1-8eb0-5f83a30f3e53", "wpostma");

host.defineMidiPorts(1, 1);

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

// knobs:
var cc_knob_01 = 13; // drive knob in the amp tone controls
var cc_knob_02 = 14; // bass  knob in the amp tone controls
var cc_knob_03 = 15; // lo mid knob in the amp tone controls
var cc_knob_04 = 16; // hi mid knob in the amp tone controls
var cc_knob_05 = 21; // treble knob in the amp tone controls
var cc_knob_06 = 17; // channel volume knob in the amp tone controls

// this stuff is NOT generic it's the CC maps for a specific device, and is left in here as sample code.
// for a real controller begin by defining the CCs used by various buttons.
var cc_switch_amp_on_off	= 111;
var cc_switch_stomp_on_off	= 25;
var cc_switch_mod_on_off	= 50;
var cc_switch_delay_on_off	= 28;
var cc_momentary_tap  		= 64;

// program change stuff
var program = 1;
var bank = 1;


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
   keys = host.getMidiInPort(0).createNoteInput("GenericTrace Keys", "80????", "90????", "B001??", "B002??", "B007??", "B00B??", "B040??", "C0????", "D0????", "E0????");
   keys.setShouldConsumeEvents(false);
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
   

   if (trace>0) {

      if (midi.isChannelController()) {
         msgtype = "CC";
      } else if (midi.isNoteOn()) {
         msgtype = "NOTE ON "+midi.note();
      } else if (midi.isNoteOff()) {
         msgtype = "NOTE OFF "+midi.note();
      } else if (midi.isKeyPressure()){
         msgtype = "POLY AFTERTOUCH";
      }
   
     println("MIDI MESSAGE #"+pad(callcount,6)+" CHANNEL "+midi.channel()+" --> "+status+"("+msgtype+")  :  data1="+midi.data1+", data2="+midi.data2);
   }

   // if (midi.isChannelController()) {
	// if (midi.data1==cc_switch_amp_on_off) {
   // 	  println("F1:AMP "+midi.data1+" "+onOff(midi.data2)) 
   //      DO SOMETHING.
	// }
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
