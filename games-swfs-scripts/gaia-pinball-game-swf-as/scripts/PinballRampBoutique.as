package
{
   import com.gaiaonline.games.gPinball.compound_elements.RampBoutique;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1009")]
   public dynamic class PinballRampBoutique extends RampBoutique
   {
      
      public function PinballRampBoutique()
      {
         super();
         addFrameScript(0,frame1);
         __setProp_enter_ramp_mcPinballMachineRampBoutique_RampTriggers_1();
         __setProp_enter_out_mcPinballMachineRampBoutique_RampTriggers_1();
         __setProp_boutiqueSaucer_mcPinballMachineRampBoutique_BoutiqueLock_1();
      }
      
      internal function __setProp_enter_ramp_mcPinballMachineRampBoutique_RampTriggers_1() : *
      {
         try
         {
            enter_ramp["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         enter_ramp.__Active = true;
         enter_ramp.__EffectTrigger = false;
         enter_ramp.__Location = "table";
         enter_ramp.__FuncArgs = ["null"];
         enter_ramp.__TriggerString = "enterRampBoutique";
         enter_ramp.__SndEffect = "none";
         enter_ramp.__CoreFunc = true;
         try
         {
            enter_ramp["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_enter_out_mcPinballMachineRampBoutique_RampTriggers_1() : *
      {
         try
         {
            enter_out["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         enter_out.__Active = true;
         enter_out.__EffectTrigger = false;
         enter_out.__Location = "boutiqueramp";
         enter_out.__FuncArgs = ["null"];
         enter_out.__TriggerString = "exitRampBoutique";
         enter_out.__SndEffect = "none";
         enter_out.__CoreFunc = true;
         try
         {
            enter_out["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function frame1() : *
      {
         stop();
      }
      
      internal function __setProp_boutiqueSaucer_mcPinballMachineRampBoutique_BoutiqueLock_1() : *
      {
         try
         {
            boutiqueSaucer["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         boutiqueSaucer.__Active = true;
         boutiqueSaucer.__EjectLocation = "this";
         boutiqueSaucer.__EjectSpeedMax = 1;
         boutiqueSaucer.__EjectSpeedMin = 15;
         boutiqueSaucer.__FunctionString = "enterBoutiqueSaucer";
         boutiqueSaucer.__Location = "boutiqueramp";
         boutiqueSaucer.__FuncArgs = ["null"];
         boutiqueSaucer.__SndEffectEject = "none";
         boutiqueSaucer.__SndEffectLock = "none";
         boutiqueSaucer.__SaucerVis = true;
         boutiqueSaucer.__SaucerType = "lock";
         boutiqueSaucer.__CoreFunc = true;
         try
         {
            boutiqueSaucer["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
   }
}

