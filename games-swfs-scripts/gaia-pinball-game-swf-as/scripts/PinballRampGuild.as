package
{
   import com.gaiaonline.games.gPinball.compound_elements.RampGuild;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1121")]
   public dynamic class PinballRampGuild extends RampGuild
   {
      
      public function PinballRampGuild()
      {
         super();
         addFrameScript(0,frame1);
         __setProp_multiballTrigger_mcPinballMachineRampGuild_multiballTrigger_1();
         __setProp_guildSpinner_mcPinballMachineRampGuild_GuildSPinner_1();
         __setProp_enter_out_mcPinballMachineRampGuild_RampTriggers_1();
         __setProp_enter_ramp_mcPinballMachineRampGuild_RampTriggers_1();
         __setProp_exit_ramp_mcPinballMachineRampGuild_RampTriggers_1();
      }
      
      internal function __setProp_exit_ramp_mcPinballMachineRampGuild_RampTriggers_1() : *
      {
         try
         {
            exit_ramp["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         exit_ramp.__Active = true;
         exit_ramp.__EffectTrigger = false;
         exit_ramp.__Location = "guildramp";
         exit_ramp.__TriggerString = "exitRampGuild";
         exit_ramp.__SndEffect = "none";
         exit_ramp.__CoreFunc = true;
         try
         {
            exit_ramp["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_multiballTrigger_mcPinballMachineRampGuild_multiballTrigger_1() : *
      {
         try
         {
            multiballTrigger["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         multiballTrigger.__Active = false;
         multiballTrigger.__EffectTrigger = false;
         multiballTrigger.__Location = "guildramp";
         multiballTrigger.__TriggerString = "startMultiball";
         multiballTrigger.__SndEffect = "none";
         multiballTrigger.__CoreFunc = true;
         try
         {
            multiballTrigger["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function frame1() : *
      {
         stop();
      }
      
      internal function __setProp_enter_ramp_mcPinballMachineRampGuild_RampTriggers_1() : *
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
         enter_ramp.__TriggerString = "enterRampGuild";
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
      
      internal function __setProp_guildSpinner_mcPinballMachineRampGuild_GuildSPinner_1() : *
      {
         try
         {
            guildSpinner["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         guildSpinner.__Deceleration = 0.25;
         guildSpinner.__SpinEnergy = 10;
         guildSpinner.__SndEffectEvent = "guildeventspinner";
         guildSpinner.__Location = "guildramp";
         guildSpinner.__MaxLevel = 0;
         guildSpinner.__SndEffect = "guildspinner";
         guildSpinner.__SpinFrames = 6;
         try
         {
            guildSpinner["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_enter_out_mcPinballMachineRampGuild_RampTriggers_1() : *
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
         enter_out.__Location = "guildramp";
         enter_out.__TriggerString = "exitRampGuild";
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
   }
}

