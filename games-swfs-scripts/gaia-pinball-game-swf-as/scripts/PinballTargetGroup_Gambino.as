package
{
   import com.gaiaonline.games.gPinball.compound_elements.TargetGroup;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1383")]
   public dynamic class PinballTargetGroup_Gambino extends TargetGroup
   {
      
      public function PinballTargetGroup_Gambino()
      {
         super();
         addFrameScript(0,frame1);
         __setProp_target2_mcPinballMachineDropTargetGroup_Gambino_Targets_1();
         __setProp_target0_mcPinballMachineDropTargetGroup_Gambino_Layer14_1();
         __setProp_target1_mcPinballMachineDropTargetGroup_Gambino_Layer13_1();
      }
      
      internal function __setProp_target2_mcPinballMachineDropTargetGroup_Gambino_Targets_1() : *
      {
         try
         {
            target2["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         target2.__Active = true;
         target2.__GroupQueue = "__HitQueue";
         target2.__DropLevel = 1;
         target2.__LightLevel = 1;
         target2.__Location = "table";
         target2.__SndEffectLevel = true;
         target2.__SndEffectHit = "gambino";
         target2.__SndEffectUnhit = "none";
         target2.__TargetType = "drop";
         try
         {
            target2["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_target1_mcPinballMachineDropTargetGroup_Gambino_Layer13_1() : *
      {
         try
         {
            target1["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         target1.__Active = true;
         target1.__GroupQueue = "__HitQueue";
         target1.__DropLevel = 1;
         target1.__LightLevel = 1;
         target1.__Location = "table";
         target1.__SndEffectLevel = true;
         target1.__SndEffectHit = "gambino";
         target1.__SndEffectUnhit = "none";
         target1.__TargetType = "drop";
         try
         {
            target1["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function frame1() : *
      {
      }
      
      internal function __setProp_target0_mcPinballMachineDropTargetGroup_Gambino_Layer14_1() : *
      {
         try
         {
            target0["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         target0.__Active = true;
         target0.__GroupQueue = "__HitQueue";
         target0.__DropLevel = 1;
         target0.__LightLevel = 1;
         target0.__Location = "table";
         target0.__SndEffectLevel = true;
         target0.__SndEffectHit = "gambino";
         target0.__SndEffectUnhit = "none";
         target0.__TargetType = "drop";
         try
         {
            target0["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
   }
}

