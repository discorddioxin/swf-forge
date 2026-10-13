package com.gaiaonline.games.gPinball.compound_elements
{
   import com.gaiaonline.games.gPinball.PinballCore;
   import com.gaiaonline.games.gPinball.simple_elements.Ball;
   import com.gaiaonline.games.gPinball.simple_elements.Trigger;
   import flash.display.MovieClip;
   import flash.events.Event;
   
   public class RampHelson extends Ramp
   {
      
      public var activeBall:Ball;
      
      public var hBall:Ball;
      
      public var helsonBumper2:Bumper;
      
      public var helsonBumper0:Bumper;
      
      public var helsonBumper3:Bumper;
      
      public var helsonBumper4:Bumper;
      
      public var helsonBumper1:Bumper;
      
      public var drainTrigger:Trigger;
      
      public var launchSaucer:Saucer;
      
      public var lightning:MovieClip;
      
      public var hFlipper_lc:Flipper;
      
      public var hFlipper_ll:Flipper;
      
      public var helsonTargets:TargetGroup;
      
      public var drainTrigger1:Trigger;
      
      public var drainTrigger2:Trigger;
      
      public var drainTrigger5:Trigger;
      
      public var drainTrigger3:Trigger;
      
      public var drainTrigger4:Trigger;
      
      public var hFlipper_rc:Flipper;
      
      public var hFlipper_rr:Flipper;
      
      public function RampHelson()
      {
         super();
         disappear();
         __Location = "helsonramp";
         __HasScore = false;
         __HasBrake = false;
         addEventListener("enterFrame",initFlippers,false,0,true);
      }
      
      public function setActive(param1:Boolean) : void
      {
         if(param1)
         {
            enableFlippers();
         }
         else
         {
            disableFlippers();
         }
      }
      
      public function initFlippers(param1:Event) : void
      {
         removeEventListener("enterFrame",initFlippers);
         hFlipper_ll.init(PinballCore.__Table.__DefaultLeftFlipperKey);
         hFlipper_lc.init(PinballCore.__Table.__DefaultLeftFlipperKey);
         hFlipper_rc.init(PinballCore.__Table.__DefaultRightFlipperKey);
         hFlipper_rr.init(PinballCore.__Table.__DefaultRightFlipperKey);
         disableFlippers();
      }
      
      public function makeReady() : void
      {
         dTrace("makeReady Helson Ramp (Trigger the eject)");
         enableFlippers();
         dTrace("Lock object is " + launchSaucer.__LockObject);
         launchSaucer.ejectIn(1000);
      }
      
      public function deactivate() : void
      {
         setActive(false);
         gotoAndPlay("hide");
      }
      
      public function doLightning(param1:String) : void
      {
         lightning.gotoAndStop(param1);
      }
      
      public function makeUnready() : void
      {
         __Active = false;
         if(visible)
         {
            PinballCore.__Root.finishExitRampHelson(null);
         }
         disappear();
      }
      
      public function activate() : void
      {
         __Active = true;
         setActive(true);
         gotoAndPlay("show");
         visible = true;
      }
      
      override public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[RampHelson]",param1);
      }
      
      public function enableFlippers() : void
      {
         hFlipper_ll.setActive(true);
         hFlipper_lc.setActive(true);
         hFlipper_rc.setActive(true);
         hFlipper_rr.setActive(true);
      }
      
      public function disappear() : void
      {
         visible = false;
      }
      
      public function disableFlippers() : void
      {
         hFlipper_ll.setActive(false);
         hFlipper_lc.setActive(false);
         hFlipper_rc.setActive(false);
         hFlipper_rr.setActive(false);
      }
   }
}

