package
{
   import com.gaiaonline.games.gPinball.compound_elements.Bumper;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1584")]
   public dynamic class mcPinballMachineVonHelsonBumper01 extends Bumper
   {
      
      public function mcPinballMachineVonHelsonBumper01()
      {
         super();
         addFrameScript(0,frame1);
      }
      
      internal function frame1() : *
      {
         bumperInit(null);
         stop();
      }
   }
}

