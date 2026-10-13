package
{
   import adobe.utils.*;
   import com.gaiaonline.games.gPinball.compound_elements.Spinner;
   import flash.accessibility.*;
   import flash.display.*;
   import flash.errors.*;
   import flash.events.*;
   import flash.external.*;
   import flash.filters.*;
   import flash.geom.*;
   import flash.media.*;
   import flash.net.*;
   import flash.printing.*;
   import flash.system.*;
   import flash.text.*;
   import flash.ui.*;
   import flash.utils.*;
   import flash.xml.*;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1288")]
   public dynamic class PinballSpinnerToken extends Spinner
   {
      
      public function PinballSpinnerToken()
      {
         super();
         addFrameScript(0,frame1);
         __setProp_spinner_trig2_mcPinballMachineSpinnerToken_Layer3_1();
         __setProp_spinner_trig1_mcPinballMachineSpinnerToken_Layer3_1();
      }
      
      internal function __setProp_spinner_trig2_mcPinballMachineSpinnerToken_Layer3_1() : *
      {
         try
         {
            spinner_trig2["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         spinner_trig2.__Active = true;
         spinner_trig2.__EffectTrigger = false;
         spinner_trig2.__Location = "useParent";
         spinner_trig2.__TriggerString = "hitSpinner";
         spinner_trig2.__SndEffect = "none";
         spinner_trig2.__CoreFunc = false;
         try
         {
            spinner_trig2["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function frame1() : *
      {
         init();
      }
      
      internal function __setProp_spinner_trig1_mcPinballMachineSpinnerToken_Layer3_1() : *
      {
         try
         {
            spinner_trig1["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         spinner_trig1.__Active = true;
         spinner_trig1.__EffectTrigger = false;
         spinner_trig1.__Location = "useParent";
         spinner_trig1.__TriggerString = "hitSpinner";
         spinner_trig1.__SndEffect = "none";
         spinner_trig1.__CoreFunc = false;
         try
         {
            spinner_trig1["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
   }
}

