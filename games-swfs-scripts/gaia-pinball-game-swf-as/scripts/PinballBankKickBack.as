package
{
   import com.gaiaonline.games.gPinball.compound_elements.RampBankKickBack;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol991")]
   public dynamic class PinballBankKickBack extends RampBankKickBack
   {
      
      public function PinballBankKickBack()
      {
         super();
         addFrameScript(0,frame1);
         __setProp_BKBSaucer_mcPinballMachineRampBankKickBack_BankSaucer_1();
         __setProp_enter_ramp_mcPinballMachineRampBankKickBack_RampTriggers_1();
         __setProp_exit_ramp_mcPinballMachineRampBankKickBack_RampTriggers_1();
      }
      
      internal function __setProp_BKBSaucer_mcPinballMachineRampBankKickBack_BankSaucer_1() : *
      {
         try
         {
            BKBSaucer["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         BKBSaucer.__Active = true;
         BKBSaucer.__EjectLocation = "this";
         BKBSaucer.__EjectSpeedMax = 20;
         BKBSaucer.__EjectSpeedMin = 15;
         BKBSaucer.__FunctionString = "enterBKBSaucer";
         BKBSaucer.__Location = "bkbramp";
         BKBSaucer.__FuncArgs = ["null"];
         BKBSaucer.__SndEffectEject = "kickback";
         BKBSaucer.__SndEffectLock = "none";
         BKBSaucer.__SaucerVis = true;
         BKBSaucer.__SaucerType = "lock";
         BKBSaucer.__CoreFunc = true;
         try
         {
            BKBSaucer["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function frame1() : *
      {
         stop();
      }
      
      internal function __setProp_exit_ramp_mcPinballMachineRampBankKickBack_RampTriggers_1() : *
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
         exit_ramp.__Location = "bkbramp";
         exit_ramp.__TriggerString = "exitRampBKB";
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
      
      internal function __setProp_enter_ramp_mcPinballMachineRampBankKickBack_RampTriggers_1() : *
      {
         try
         {
            enter_ramp["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         enter_ramp.__Active = false;
         enter_ramp.__EffectTrigger = false;
         enter_ramp.__Location = "table";
         enter_ramp.__TriggerString = "enterRampBKB";
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
   }
}

