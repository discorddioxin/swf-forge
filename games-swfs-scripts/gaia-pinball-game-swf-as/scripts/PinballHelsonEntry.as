package
{
   import adobe.utils.*;
   import com.gaiaonline.games.gPinball.compound_elements.ToggleGroup;
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
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1239")]
   public dynamic class PinballHelsonEntry extends ToggleGroup
   {
      
      public var __id17_:PinballBooster;
      
      public var __id11_:PinballBooster;
      
      public var __id12_:PinballBooster;
      
      public var __id13_:PinballBooster;
      
      public var __id14_:PinballBooster;
      
      public var __id15_:PinballBooster;
      
      public var __id16_:PinballBooster;
      
      public function PinballHelsonEntry()
      {
         super();
         addFrameScript(0,frame1,29,frame30,59,frame60);
         __setProp___id15__mcPinballHelsonEntry_Layer2_1();
         __setProp___id17__mcPinballHelsonEntry_Layer2_1();
         __setProp_helsonSaucer_mcPinballHelsonEntry_Layer1_1();
         __setProp___id16__mcPinballHelsonEntry_Layer2_1();
         __setProp___id12__mcPinballHelsonEntry_Layer2_1();
         __setProp___id14__mcPinballHelsonEntry_Layer2_1();
         __setProp___id11__mcPinballHelsonEntry_Layer2_1();
         __setProp___id13__mcPinballHelsonEntry_Layer2_1();
      }
      
      internal function __setProp___id12__mcPinballHelsonEntry_Layer2_1() : *
      {
         try
         {
            __id12_["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         __id12_.__MyLocation = "table";
         __id12_.__OverDir = true;
         __id12_.__Power = 7;
         __id12_.__MySndEffect = "none";
         try
         {
            __id12_["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp___id11__mcPinballHelsonEntry_Layer2_1() : *
      {
         try
         {
            __id11_["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         __id11_.__MyLocation = "table";
         __id11_.__OverDir = true;
         __id11_.__Power = 10;
         __id11_.__MySndEffect = "none";
         try
         {
            __id11_["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_helsonSaucer_mcPinballHelsonEntry_Layer1_1() : *
      {
         try
         {
            helsonSaucer["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         helsonSaucer.__Active = false;
         helsonSaucer.__EjectLocation = "helsonSaucerExit";
         helsonSaucer.__EjectSpeedMax = 1;
         helsonSaucer.__EjectSpeedMin = 10;
         helsonSaucer.__FunctionString = "enterHelsonSaucer";
         helsonSaucer.__Location = "table";
         helsonSaucer.__SndEffectEject = "none";
         helsonSaucer.__SndEffectLock = "none";
         helsonSaucer.__SaucerVis = false;
         helsonSaucer.__SaucerType = "lock";
         helsonSaucer.__CoreFunc = true;
         try
         {
            helsonSaucer["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp___id17__mcPinballHelsonEntry_Layer2_1() : *
      {
         try
         {
            __id17_["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         __id17_.__MyLocation = "table";
         __id17_.__OverDir = true;
         __id17_.__Power = 7;
         __id17_.__MySndEffect = "none";
         try
         {
            __id17_["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function frame1() : *
      {
         stop();
      }
      
      internal function __setProp___id16__mcPinballHelsonEntry_Layer2_1() : *
      {
         try
         {
            __id16_["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         __id16_.__MyLocation = "table";
         __id16_.__OverDir = true;
         __id16_.__Power = 7;
         __id16_.__MySndEffect = "none";
         try
         {
            __id16_["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function frame30() : *
      {
         stop();
         makeReady();
      }
      
      internal function __setProp___id15__mcPinballHelsonEntry_Layer2_1() : *
      {
         try
         {
            __id15_["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         __id15_.__MyLocation = "table";
         __id15_.__OverDir = true;
         __id15_.__Power = 7;
         __id15_.__MySndEffect = "none";
         try
         {
            __id15_["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp___id14__mcPinballHelsonEntry_Layer2_1() : *
      {
         try
         {
            __id14_["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         __id14_.__MyLocation = "table";
         __id14_.__OverDir = true;
         __id14_.__Power = 10;
         __id14_.__MySndEffect = "none";
         try
         {
            __id14_["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function frame60() : *
      {
         gotoAndStop(1);
      }
      
      internal function __setProp___id13__mcPinballHelsonEntry_Layer2_1() : *
      {
         try
         {
            __id13_["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         __id13_.__MyLocation = "table";
         __id13_.__OverDir = true;
         __id13_.__Power = 10;
         __id13_.__MySndEffect = "none";
         try
         {
            __id13_["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
   }
}

